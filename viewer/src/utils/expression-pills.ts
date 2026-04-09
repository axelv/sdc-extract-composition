import { parser } from "lezer-fhirpath";
import type { SyntaxNode } from "@lezer/common";
import type { QuestionnaireIndex } from "./questionnaire-index";

// ---------------------------------------------------------------------------
// Segment types — the output of segmentExpression()
// ---------------------------------------------------------------------------

export interface AnswerPillSegment {
  kind: "answer-pill";
  from: number;
  to: number;
  /** Chain of linkIds traversed, e.g. ['resectie', 'nabloeding'] */
  linkIds: string[];
}

export interface CodePillSegment {
  kind: "code-pill";
  from: number;
  to: number;
  /** The raw code string (e.g. '373067005') */
  value: string;
  /** The linkId whose answerOptions can resolve this code to a display */
  contextLinkId: string;
}

export interface TextSegment {
  kind: "text";
  from: number;
  to: number;
  text: string;
}

export type ExpressionSegment =
  | AnswerPillSegment
  | CodePillSegment
  | TextSegment;

// ---------------------------------------------------------------------------
// QR navigation state machine
// ---------------------------------------------------------------------------

const enum QRState {
  START,
  ITEM,
  ITEM_FILTERED,
  ANSWER,
  VALUE,
  PROP,
  REJECTED,
}

interface ChainStep {
  kind: "identifier" | "function" | "external";
  name: string;
  from: number;
  to: number;
  linkId?: string;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/** Extract the linkId string from a `where(linkId='...')` Function node. */
function extractLinkIdFromWhere(
  funcNode: SyntaxNode,
  expr: string
): string | null {
  const paramList = funcNode.getChild("ParamList");
  if (!paramList) return null;

  const equality = paramList.getChild("EqualityExpression");
  if (!equality) return null;

  const leftIdent = equality.firstChild;
  if (!leftIdent || leftIdent.type.name !== "Identifier") return null;
  if (expr.slice(leftIdent.from, leftIdent.to) !== "linkId") return null;

  const literal = equality.getChild("Literal");
  if (!literal) return null;

  const str = literal.getChild("String");
  if (!str) return null;

  return expr.slice(str.from + 1, str.to - 1); // strip quotes
}

/**
 * Decompose an InvocationExpression tree into a flat list of chain steps.
 * Returns null if the node shape is unexpected.
 */
function decomposeChain(
  node: SyntaxNode,
  expr: string
): ChainStep[] | null {
  if (node.type.name === "Identifier") {
    const name = expr.slice(node.from, node.to);
    return [{ kind: "identifier", name, from: node.from, to: node.to }];
  }

  if (node.type.name === "ExternalConstant") {
    const name = expr.slice(node.from, node.to);
    return [{ kind: "external", name, from: node.from, to: node.to }];
  }

  if (node.type.name === "InvocationExpression") {
    const receiver = node.firstChild;
    const member = node.lastChild;
    if (!receiver || !member || receiver === member) return null;

    const leftSteps = decomposeChain(receiver, expr);
    if (!leftSteps) return null;

    if (member.type.name === "Identifier") {
      const name = expr.slice(member.from, member.to);
      leftSteps.push({
        kind: "identifier",
        name,
        from: member.from,
        to: member.to,
      });
      return leftSteps;
    }

    if (member.type.name === "Function") {
      const funcIdent = member.firstChild;
      if (!funcIdent || funcIdent.type.name !== "Identifier") return null;
      const name = expr.slice(funcIdent.from, funcIdent.to);
      const linkId =
        name === "where"
          ? extractLinkIdFromWhere(member, expr) ?? undefined
          : undefined;
      leftSteps.push({
        kind: "function",
        name,
        from: member.from,
        to: member.to,
        linkId,
      });
      return leftSteps;
    }
  }

  return null;
}

/**
 * Run the QR state machine over a decomposed chain.
 * Returns the linkId chain and pill kind if the chain matches an answer-value
 * or navigation pattern.
 */
function matchQRPath(
  steps: ChainStep[]
): { linkIds: string[]; kind: "answer-pill" | "navigation-pill" } | null {
  let state: QRState = QRState.START;
  const linkIds: string[] = [];

  for (const step of steps) {
    switch (state) {
      case QRState.START:
        if (step.kind === "external") continue;
        if (step.kind === "identifier" && step.name === "item") {
          state = QRState.ITEM;
        } else {
          state = QRState.REJECTED;
        }
        break;

      case QRState.ITEM:
        if (step.kind === "function" && step.name === "where" && step.linkId) {
          linkIds.push(step.linkId);
          state = QRState.ITEM_FILTERED;
        } else {
          state = QRState.REJECTED;
        }
        break;

      case QRState.ITEM_FILTERED:
        if (step.kind === "identifier" && step.name === "answer") {
          state = QRState.ANSWER;
        } else if (step.kind === "identifier" && step.name === "item") {
          state = QRState.ITEM;
        } else {
          state = QRState.REJECTED;
        }
        break;

      case QRState.ANSWER:
        if (step.kind === "identifier" && step.name === "value") {
          state = QRState.VALUE;
        } else if (step.kind === "identifier" && step.name === "item") {
          state = QRState.ITEM;
        } else {
          state = QRState.REJECTED;
        }
        break;

      case QRState.VALUE:
        if (
          step.kind === "identifier" &&
          (step.name === "code" || step.name === "display")
        ) {
          state = QRState.PROP;
        } else {
          state = QRState.REJECTED;
        }
        break;

      case QRState.REJECTED:
        return null;

      default:
        return null;
    }
  }

  if (state === QRState.VALUE || state === QRState.PROP) {
    return { linkIds, kind: "answer-pill" };
  }
  if (state === QRState.ITEM_FILTERED && linkIds.length > 0) {
    return { linkIds, kind: "navigation-pill" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pill finders — walk the AST to locate pill-able ranges
// ---------------------------------------------------------------------------

type RawPill = AnswerPillSegment | CodePillSegment;

/**
 * Try to match a node as an answer-value or navigation path.
 * Returns the pill if matched, null otherwise.
 */
function tryMatchPath(
  node: SyntaxNode,
  expr: string
): AnswerPillSegment | null {
  if (node.type.name !== "InvocationExpression") return null;

  const chain = decomposeChain(node, expr);
  if (!chain) return null;

  const match = matchQRPath(chain);
  if (!match) return null;

  // Find the start of the path (first 'item' identifier, skipping %resource/%context)
  const firstItem = chain.find(
    (s) => s.kind === "identifier" && s.name === "item"
  );
  const from = firstItem?.from ?? node.from;

  return {
    kind: "answer-pill",
    from,
    to: node.to,
    linkIds: match.linkIds,
  };
}

/**
 * Find all answer-value pills in the tree.
 * Stops recursing into subtrees that are consumed by a pill.
 */
function findAnswerPills(
  root: SyntaxNode,
  expr: string
): AnswerPillSegment[] {
  const pills: AnswerPillSegment[] = [];

  function visit(node: SyntaxNode): void {
    const pill = tryMatchPath(node, expr);
    if (pill) {
      pills.push(pill);
      return; // don't recurse into matched subtree
    }

    let child = node.firstChild;
    while (child) {
      visit(child);
      child = child.nextSibling;
    }
  }

  visit(root);
  return pills;
}

/**
 * Try to extract the code from a %factory.Coding(system, code) invocation.
 * Returns the code string and the node range, or null.
 */
function tryExtractFactoryCoding(
  node: SyntaxNode,
  expr: string
): { code: string; from: number; to: number } | null {
  if (node.type.name !== "InvocationExpression") return null;

  const receiver = node.firstChild;
  const member = node.lastChild;
  if (!receiver || !member) return null;

  // Check receiver is %factory
  if (receiver.type.name !== "ExternalConstant") return null;
  const extName = expr.slice(receiver.from, receiver.to);
  if (extName !== "%factory") return null;

  // Check member is Function named "Coding"
  if (member.type.name !== "Function") return null;
  const funcIdent = member.firstChild;
  if (!funcIdent || expr.slice(funcIdent.from, funcIdent.to) !== "Coding") return null;

  // Extract second argument (code) from ParamList
  const paramList = member.getChild("ParamList");
  if (!paramList) return null;

  const literals: SyntaxNode[] = [];
  let child = paramList.firstChild;
  while (child) {
    if (child.type.name === "Literal") literals.push(child);
    child = child.nextSibling;
  }

  if (literals.length < 2) return null;
  const codeNode = literals[1].getChild("String");
  if (!codeNode) return null;

  return {
    code: expr.slice(codeNode.from + 1, codeNode.to - 1),
    from: node.from,
    to: node.to,
  };
}

/**
 * Find code pills: string literals or %factory.Coding() calls that appear
 * opposite an answer pill in an EqualityExpression.
 */
function findCodePills(
  root: SyntaxNode,
  expr: string,
  answerPills: AnswerPillSegment[]
): CodePillSegment[] {
  const codePills: CodePillSegment[] = [];

  function visit(node: SyntaxNode): void {
    if (node.type.name === "EqualityExpression") {
      let matchedPill: AnswerPillSegment | undefined;
      let literalNode: SyntaxNode | undefined;
      let factoryCoding: { code: string; from: number; to: number } | null = null;

      let child = node.firstChild;
      while (child) {
        if (child.type.name === "InvocationExpression") {
          // Check if it's an answer pill
          const pill = answerPills.find(
            (p) => p.from <= child!.from && p.to >= child!.to
          );
          if (pill) {
            matchedPill = pill;
          } else {
            // Check if it's a %factory.Coding(...) call
            factoryCoding = tryExtractFactoryCoding(child, expr);
          }
        }
        if (child.type.name === "Literal") {
          literalNode = child;
        }
        child = child.nextSibling;
      }

      if (matchedPill) {
        const contextLinkId = matchedPill.linkIds[matchedPill.linkIds.length - 1];

        // %factory.Coding(system, code) on the other side
        if (factoryCoding) {
          codePills.push({
            kind: "code-pill",
            from: factoryCoding.from,
            to: factoryCoding.to,
            value: factoryCoding.code,
            contextLinkId,
          });
        }
        // Plain string literal on the other side (legacy .code = 'X' pattern)
        else if (literalNode) {
          const str = literalNode.getChild("String");
          if (str) {
            codePills.push({
              kind: "code-pill",
              from: literalNode.from,
              to: literalNode.to,
              value: expr.slice(str.from + 1, str.to - 1),
              contextLinkId,
            });
          }
        }
      }
    }

    let child = node.firstChild;
    while (child) {
      visit(child);
      child = child.nextSibling;
    }
  }

  visit(root);
  return codePills;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build segments from pill ranges, filling gaps with text segments.
 */
function buildSegments(
  expr: string,
  pills: RawPill[]
): ExpressionSegment[] {
  const segments: ExpressionSegment[] = [];
  let pos = 0;

  for (const pill of pills) {
    if (pill.from > pos) {
      segments.push({
        kind: "text",
        from: pos,
        to: pill.from,
        text: expr.slice(pos, pill.from),
      });
    }
    segments.push(pill);
    pos = pill.to;
  }

  if (pos < expr.length) {
    segments.push({
      kind: "text",
      from: pos,
      to: expr.length,
      text: expr.slice(pos, expr.length),
    });
  }

  return segments;
}

/**
 * Render a segmented expression as an HTML string with pill markup.
 * Used by buildLabelHtml for the dangerouslySetInnerHTML code path.
 */
export function segmentExpressionToHtml(
  expr: string,
  index?: QuestionnaireIndex
): string {
  if (!index) return escapeHtml(expr);

  const segments = segmentExpression(expr);
  const hasPills = segments.some((s) => s.kind !== "text");
  if (!hasPills) return escapeHtml(expr);

  return segments
    .map((seg) => {
      if (seg.kind === "text") {
        return `<span class="expr-text">${escapeHtml(seg.text)}</span>`;
      }
      if (seg.kind === "answer-pill") {
        const lastLinkId = seg.linkIds[seg.linkIds.length - 1];
        const label = index.resolveItemText(lastLinkId) ?? lastLinkId;
        return `<span class="expr-pill answer" title="linkId: ${escapeHtml(seg.linkIds.join(" → "))}">${escapeHtml(label)}</span>`;
      }
      if (seg.kind === "code-pill") {
        const display = index.resolveCodeDisplay(seg.contextLinkId, seg.value);
        const label = display ?? humanizeCode(seg.value);
        return `<span class="expr-pill code" title="code: ${escapeHtml(seg.value)}">${escapeHtml(label)}</span>`;
      }
      return "";
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeCode(code: string): string {
  return code
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Parse a FHIRPath expression and segment it into text and pill ranges.
 *
 * Answer-value paths (e.g., `item.where(linkId='sedatie').answer.value.code`)
 * become answer pills. String literals compared to answer paths become code pills.
 * Everything else stays as text.
 */
export function segmentExpression(expr: string): ExpressionSegment[] {
  try {
    const tree = parser.parse(expr);
    const root = tree.topNode;

    const answerPills = findAnswerPills(root, expr);
    const codePills = findCodePills(root, expr, answerPills);
    const allPills: RawPill[] = [...answerPills, ...codePills].sort(
      (a, b) => a.from - b.from
    );

    return buildSegments(expr, allPills);
  } catch {
    // Parse error → return entire expression as text
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }
}
