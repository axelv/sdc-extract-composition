import { annotate_expression, type Annotation } from "fhirpath-rs";
import { isWasmReady } from "./wasm-init";
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
// Wasm annotation → segment mapping
// ---------------------------------------------------------------------------

type RawPill = AnswerPillSegment | CodePillSegment;

function annotationToPill(annotation: Annotation): RawPill | null {
  const { span, kind } = annotation;
  switch (kind.type) {
    case "answer_reference":
    case "item_reference":
      // Render both as answer-style pills — preserves the prior visual where
      // `item.where(linkId='X')` (navigation prefix) and full answer paths
      // both surface as a labeled chip.
      return {
        kind: "answer-pill",
        from: span.start,
        to: span.end,
        linkIds: kind.link_ids,
      };
    case "coded_value":
      return {
        kind: "code-pill",
        from: span.start,
        to: span.end,
        value: kind.code,
        contextLinkId: kind.context_link_id,
      };
  }
}

/**
 * Build segments from pill ranges, filling gaps with text segments.
 * Pills are assumed sorted by `from` and non-overlapping.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a FHIRPath expression and segment it into text and pill ranges via
 * the wasm analyzer.
 *
 * Returns a single text segment if the wasm module isn't ready yet (callers
 * subscribed to `useWasmReady` will re-render once it is) or if the analyzer
 * throws on the input.
 */
export function segmentExpression(expr: string): ExpressionSegment[] {
  if (!isWasmReady()) {
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }

  let annotations: Annotation[];
  try {
    annotations = annotate_expression(expr);
  } catch {
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }

  const pills: RawPill[] = [];
  for (const annotation of annotations) {
    const pill = annotationToPill(annotation);
    if (pill) pills.push(pill);
  }
  pills.sort((a, b) => a.from - b.from);

  // Drop pills whose range overlaps an earlier-starting pill — defensive only;
  // the analyzer's `find_coded_values` already excludes ranges inside an
  // answer-ref, but a future kind could overlap.
  const nonOverlapping: RawPill[] = [];
  let lastEnd = -1;
  for (const pill of pills) {
    if (pill.from < lastEnd) continue;
    nonOverlapping.push(pill);
    lastEnd = pill.to;
  }

  return buildSegments(expr, nonOverlapping);
}

/**
 * Render a segmented expression as an HTML string with pill markup.
 * Used by callers that need to inject the result via dangerouslySetInnerHTML
 * (e.g. NarrativeHtml's pill-injection path, FhirPathPillComponent's pill
 * label).
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
