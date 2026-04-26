import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
}

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

export function getFhirPathCompletions(
  contextExpression: string | null | undefined,
  wasmQuestionnaireIndex: WasmQuestionnaireIndex | null,
): CompletionItem[] {
  const wasm: CompletionItem[] = [];
  if (wasmQuestionnaireIndex && contextExpression) {
    try {
      const items = wasmQuestionnaireIndex.generate_completions(
        contextExpression,
      ) as CompletionItem[];
      wasm.push(...items);
    } catch (e) {
      console.error("[FhirPathCompletions]", e);
    }
  }
  return [...STUB_COMPLETIONS, ...wasm];
}
