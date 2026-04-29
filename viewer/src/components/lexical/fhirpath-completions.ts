import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
  link_id: string;
  item_type: string;
  /** True if the path traverses any repeating ancestor */
  traverses_repeating?: boolean;
}

// No stub completions - UI handles context/resource scoping automatically
const STUB_COMPLETIONS: CompletionItem[] = [];

// WASM generate_completions emits insert_text relative to the supplied context
// expression (e.g. "item.where(linkId='X').answer.value"). Pills need a
// resolvable head — %resource for the global tree, %context for the
// section-scoped tree.
function withPrefix(prefix: string, items: CompletionItem[]): CompletionItem[] {
  return items.map((it) => ({ ...it, insert_text: `${prefix}.${it.insert_text}` }));
}

// One canonical entry per item — drop the .code / .display variants the engine
// emits for coding types. Users can refine via the pill editor afterward.
function valueOnly(items: CompletionItem[]): CompletionItem[] {
  return items.filter((it) => it.kind === "value");
}

function generateItemCompletions(
  questionnaireIndex: QuestionnaireIndex | undefined,
): CompletionItem[] {
  if (!questionnaireIndex) return [];

  const completions: CompletionItem[] = [];

  for (const [linkId, info] of questionnaireIndex.items) {
    if (info.type === "group" || info.type === "display") continue;

    const text = info.text || linkId;
    const path = info.path;

    completions.push({
      label: text,
      detail: `linkId: ${linkId}`,
      insert_text: `${path}.answer.value`,
      filter_text: `${text} ${linkId} resource`,
      sort_text: `10-${text}`,
      kind: "value",
      link_id: linkId,
      item_type: info.type,
    });
  }

  return completions;
}

export function getFhirPathCompletions(
  contextExpression: string | null | undefined,
  wasmQuestionnaireIndex: WasmQuestionnaireIndex | null,
  questionnaireIndex?: QuestionnaireIndex,
): CompletionItem[] {
  const wasm: CompletionItem[] = [];
  const resourceLinkIds = new Set<string>();

  if (wasmQuestionnaireIndex) {
    try {
      const resourceItems = wasmQuestionnaireIndex.generate_completions(
        "%resource",
      ) as CompletionItem[];
      console.log("[completions] %resource raw:", resourceItems);
      // Filter out items that traverse repeating ancestors (ambiguous results)
      const safeResourceItems = valueOnly(resourceItems).filter(
        (it) => !it.traverses_repeating
      );
      console.log("[completions] %resource filtered:", safeResourceItems);
      // Track which linkIds are in the safe %resource set
      for (const it of safeResourceItems) {
        if (it.link_id) resourceLinkIds.add(it.link_id);
      }
      wasm.push(...withPrefix("%resource", safeResourceItems));
    } catch (e) {
      console.error("[completions] %resource error:", e);
    }

    if (contextExpression && contextExpression !== "%resource") {
      try {
        console.log("[completions] calling generate_completions with contextExpression:", contextExpression);
        const contextItems = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        console.log("[completions] generate_completions(contextExpression) returned:", contextItems);
        console.log("[completions] contextItems length:", contextItems?.length);
        if (contextItems && contextItems.length > 0) {
          console.log("[completions] first context item:", contextItems[0]);
        }
        // Filter out items that traverse repeating ancestors and duplicates
        const uniqueContextItems = valueOnly(contextItems).filter(
          (it) => !it.traverses_repeating && (!it.link_id || !resourceLinkIds.has(it.link_id))
        );
        console.log("[completions] %context filtered:", uniqueContextItems);
        wasm.push(...withPrefix("%context", uniqueContextItems));
      } catch (e) {
        console.error("[completions] %context error:", e);
      }
    } else {
      console.log("[completions] no context expression or equals %resource:", contextExpression);
    }
  }

  // Fall back to JS-generated completions if WASM returns nothing
  if (wasm.length === 0) {
    const itemCompletions = generateItemCompletions(questionnaireIndex);
    return [...STUB_COMPLETIONS, ...itemCompletions];
  }

  return [...STUB_COMPLETIONS, ...wasm];
}
