import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
}

// Only entry-point variables - the rest comes from WASM generate_completions
export const STUB_COMPLETIONS: CompletionItem[] = [
  {
    label: "%context",
    detail: "Current extraction context",
    insert_text: "%context",
    filter_text: "context",
    sort_text: "00-context",
    kind: "value",
  },
  {
    label: "%resource",
    detail: "The QuestionnaireResponse",
    insert_text: "%resource",
    filter_text: "resource",
    sort_text: "00-resource",
    kind: "value",
  },
];

function generateItemCompletions(
  questionnaireIndex: QuestionnaireIndex | undefined,
): CompletionItem[] {
  if (!questionnaireIndex) return [];

  const completions: CompletionItem[] = [];

  for (const [linkId, info] of questionnaireIndex.items) {
    const text = info.text || linkId;
    const isChoice = info.type === "choice" || info.type === "open-choice";
    const path = info.path;

    // Use the full path for nested items
    completions.push({
      label: text,
      detail: `linkId: ${linkId}`,
      insert_text: `${path}.answer.value`,
      filter_text: `${text} ${linkId} resource`,
      sort_text: `10-${text}`,
      kind: "value",
    });

    // For choice items, add .display and .code variants
    if (isChoice) {
      completions.push({
        label: `${text} (display)`,
        detail: `linkId: ${linkId}`,
        insert_text: `${path}.answer.valueCoding.display`,
        filter_text: `${text} ${linkId} display`,
        sort_text: `11-${text}`,
        kind: "display",
      });
      completions.push({
        label: `${text} (code)`,
        detail: `linkId: ${linkId}`,
        insert_text: `${path}.answer.valueCoding.code`,
        filter_text: `${text} ${linkId} code`,
        sort_text: `12-${text}`,
        kind: "code",
      });
    }
  }

  return completions;
}

export function getFhirPathCompletions(
  contextExpression: string | null | undefined,
  wasmQuestionnaireIndex: WasmQuestionnaireIndex | null,
  questionnaireIndex?: QuestionnaireIndex,
): CompletionItem[] {
  // TODO: Use wasmQuestionnaireIndex.generate_completions() once implemented in fhirpath-rs
  // Currently returns empty for all expressions ("%resource", "%resource.item", etc.)
  // For now, generate completions from questionnaire index directly
  const itemCompletions = generateItemCompletions(questionnaireIndex);

  return [...STUB_COMPLETIONS, ...itemCompletions];
}
