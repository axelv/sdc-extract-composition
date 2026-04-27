// Infer the value shape of a pill expression for display.
//
// The wasm analyzer already extracts answer-pill segments (with linkIds) and
// code-pill segments. We pair the leaf linkId(s) with their item.type from
// the QuestionnaireIndex and project that to a human-readable "value shape"
// so the editor can show the user what the pill is going to render.

import { segmentExpression } from "./expression-pills";
import type { QuestionnaireIndex } from "./questionnaire-index";

export interface AnswerShape {
  /** The leaf linkId(s) the expression reads from. */
  linkIds: string[];
  /** Raw `item.type` from the Questionnaire (e.g. "choice", "string"). */
  itemType: string | null;
  /** Projected value shape (e.g. "Coding", "string", "integer"). */
  valueShape: string;
}

const VALUE_SHAPE_BY_ITEM_TYPE: Record<string, string> = {
  choice: "Coding",
  "open-choice": "Coding",
  coding: "Coding",
  string: "string",
  text: "string",
  integer: "integer",
  decimal: "decimal",
  boolean: "boolean",
  date: "date",
  time: "time",
  dateTime: "dateTime",
  url: "url",
  attachment: "Attachment",
  reference: "Reference",
  quantity: "Quantity",
};

/**
 * Inspect the pill expression and determine the answer shape it resolves to.
 * Returns `null` if the expression has no answer-pill segments yet (e.g. the
 * wasm analyzer hasn't loaded, or the head is plain text).
 */
export function inferAnswerShape(
  expression: string,
  index: QuestionnaireIndex | undefined,
): AnswerShape | null {
  if (!index) return null;
  const segments = segmentExpression(expression);
  const leafIds: string[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    if (seg.kind !== "answer-pill") continue;
    const leaf = seg.linkIds[seg.linkIds.length - 1];
    if (!leaf || seen.has(leaf)) continue;
    seen.add(leaf);
    leafIds.push(leaf);
  }
  if (leafIds.length === 0) return null;

  // When several answer-pills are referenced, only narrow to a single shape
  // when they all agree — otherwise fall back to "mixed".
  const itemTypes = leafIds.map((id) => index.resolveItemType(id));
  const uniqueTypes = new Set(itemTypes.filter((t): t is string => Boolean(t)));
  const itemType = uniqueTypes.size === 1 ? [...uniqueTypes][0] : null;
  const valueShape =
    uniqueTypes.size === 0
      ? "unknown"
      : uniqueTypes.size === 1
        ? (VALUE_SHAPE_BY_ITEM_TYPE[[...uniqueTypes][0]] ?? [...uniqueTypes][0])
        : "mixed";

  return { linkIds: leafIds, itemType, valueShape };
}
