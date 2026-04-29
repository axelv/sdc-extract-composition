import { useMemo } from "react";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import { useWasmQuestionnaireIndex } from "./lexical/WasmQuestionnaireIndexContext";

type Scope = "context" | "resource";

interface ForEachSelectorProps {
  value: string;
  scope?: Scope;
  questionnaireIndex?: QuestionnaireIndex;
  contextExpression?: string | null;
  onChange: (linkId: string, scope: Scope) => void;
}

interface RepeatingItem {
  linkId: string;
  text: string;
  type: string;
  scope: "context" | "resource";
}

interface WasmCompletionItem {
  link_id: string;
  label: string;
  item_type: string;
  kind: string;
  traverses_repeating?: boolean;
}

function generateRepeatingItems(
  wasmIndex: WasmQuestionnaireIndex | null,
  questionnaireIndex: QuestionnaireIndex | undefined,
  contextExpression: string | null | undefined,
): { contextItems: RepeatingItem[]; resourceItems: RepeatingItem[] } {
  const contextItems: RepeatingItem[] = [];
  const resourceItems: RepeatingItem[] = [];

  // If we have a parent context expression, we're in a nested scope - only show %context items
  // If no parent context (root level), %context = %resource, so show %resource items
  const isNestedScope = contextExpression && contextExpression !== "%resource";

  if (wasmIndex && questionnaireIndex) {
    try {
      if (isNestedScope) {
        // Nested scope: only show items from %context (parent's scope)
        const contextCompletions = wasmIndex.generate_completions(contextExpression) as WasmCompletionItem[];
        for (const item of contextCompletions) {
          // Filter out items that traverse repeating ancestors (ambiguous)
          if (item.traverses_repeating) continue;
          // Only include items that actually have repeats: true
          if (item.kind === "value" && item.link_id && questionnaireIndex.resolveItemRepeats(item.link_id)) {
            contextItems.push({
              linkId: item.link_id,
              text: item.label,
              type: item.item_type,
              scope: "context",
            });
          }
        }
      } else {
        // Root level: show %resource items (since %context = %resource at root)
        const resourceCompletions = wasmIndex.generate_completions("%resource") as WasmCompletionItem[];
        for (const item of resourceCompletions) {
          // Filter out items that traverse repeating ancestors (ambiguous from resource level)
          if (item.traverses_repeating) continue;
          // Only include items that actually have repeats: true
          if (item.kind === "value" && item.link_id && questionnaireIndex.resolveItemRepeats(item.link_id)) {
            resourceItems.push({
              linkId: item.link_id,
              text: item.label,
              type: item.item_type,
              scope: "resource",
            });
          }
        }
      }
    } catch {
      // Fall through to JS fallback
    }
  }

  // Fallback to JS questionnaire index if WASM didn't produce results (only for root level)
  if (!isNestedScope && resourceItems.length === 0 && questionnaireIndex) {
    for (const [linkId, info] of questionnaireIndex.items) {
      // Only include items with repeats: true
      if (!info.repeats) continue;
      resourceItems.push({
        linkId,
        text: info.text || linkId,
        type: info.type,
        scope: "resource",
      });
    }
  }

  return { contextItems, resourceItems };
}

export function ForEachSelector({
  value,
  scope = "context",
  questionnaireIndex,
  contextExpression,
  onChange,
}: ForEachSelectorProps) {
  const wasmIndex = useWasmQuestionnaireIndex();

  const { contextItems, resourceItems } = useMemo(
    () => generateRepeatingItems(wasmIndex, questionnaireIndex, contextExpression),
    [wasmIndex, questionnaireIndex, contextExpression]
  );

  const selectedValue = value ? `${scope}:${value}` : "";

  const handleChange = (selected: string) => {
    if (!selected) {
      onChange("", "context");
      return;
    }
    const [selectedScope, linkId] = selected.split(":", 2) as [Scope, string];
    onChange(linkId, selectedScope);
  };

  return (
    <select
      value={selectedValue}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-gray-400"
    >
      <option value="">Select a repeating item...</option>
      {contextItems.length > 0 && (
        <optgroup label="%context">
          {contextItems.map((item) => (
            <option key={`context:${item.linkId}`} value={`context:${item.linkId}`}>
              {item.text || item.linkId}
            </option>
          ))}
        </optgroup>
      )}
      {resourceItems.length > 0 && (
        <optgroup label="%resource">
          {resourceItems.map((item) => (
            <option key={`resource:${item.linkId}`} value={`resource:${item.linkId}`}>
              {item.text || item.linkId}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
