import { annotate_expression } from "@tiro-health/fhirpath-wasm";
import type { Annotation } from "@tiro-health/fhirpath-wasm";
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
// Map WASM annotations to pill segments
// ---------------------------------------------------------------------------

type RawPill = AnswerPillSegment | CodePillSegment;

function annotationsToPills(annotations: Annotation[]): RawPill[] {
  const pills: RawPill[] = [];

  for (const { span, kind } of annotations) {
    if (kind.type === "answer_reference" || kind.type === "item_reference") {
      pills.push({
        kind: "answer-pill",
        from: span.start,
        to: span.end,
        linkIds: kind.link_ids,
      });
    } else if (kind.type === "coded_value") {
      pills.push({
        kind: "code-pill",
        from: span.start,
        to: span.end,
        value: kind.code,
        contextLinkId: kind.context_link_id,
      });
    }
  }

  return pills.sort((a, b) => a.from - b.from);
}

// ---------------------------------------------------------------------------
// Build segments from pill ranges, filling gaps with text
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 * become answer pills. Coded values compared to answer paths become code pills.
 * Everything else stays as text.
 */
export function segmentExpression(expr: string): ExpressionSegment[] {
  try {
    const annotations = annotate_expression(expr);
    const pills = annotationsToPills(annotations);
    return buildSegments(expr, pills);
  } catch {
    // Parse error → return entire expression as text
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }
}
