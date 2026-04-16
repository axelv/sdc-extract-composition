import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { $createFhirPathPillNode } from "./FhirPathPillNode";
import { useWasmQuestionnaireIndex } from "./WasmQuestionnaireIndexContext";

interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
}

class FhirPathCompletionOption extends MenuOption {
  completionItem: CompletionItem;

  constructor(item: CompletionItem) {
    super(item.insert_text);
    this.completionItem = item;
  }
}

function fhirPathTriggerFn(
  text: string,
  _editor: LexicalEditor,
): MenuTextMatch | null {
  const idx = text.lastIndexOf("{{");
  if (idx === -1) return null;

  const afterTrigger = text.slice(idx + 2);

  return {
    leadOffset: idx,
    matchingString: afterTrigger,
    replaceableString: text.slice(idx),
  };
}

interface FhirPathAutocompletePluginProps {
  contextExpression?: string | null;
}

export function FhirPathAutocompletePlugin({
  contextExpression,
}: FhirPathAutocompletePluginProps) {
  const [editor] = useLexicalComposerContext();
  const wasmQuestionnaireIndex = useWasmQuestionnaireIndex();
  const [queryString, setQueryString] = useState<string | null>(null);

  const allCompletions = useMemo<CompletionItem[]>(() => {
    if (!wasmQuestionnaireIndex || !contextExpression) return [];
    try {
      return wasmQuestionnaireIndex.generate_completions(contextExpression);
    } catch (e) {
      console.error("[FhirPathAutocomplete]", e);
      return [];
    }
  }, [wasmQuestionnaireIndex, contextExpression]);

  const options = useMemo(() => {
    const query = (queryString ?? "").toLowerCase();
    return allCompletions
      .filter(
        (item) => !query || item.filter_text.toLowerCase().includes(query),
      )
      .sort((a, b) => a.sort_text.localeCompare(b.sort_text))
      .map((item) => new FhirPathCompletionOption(item));
  }, [allCompletions, queryString]);

  const onSelectOption = useCallback(
    (
      option: FhirPathCompletionOption,
      textNodeContainingQuery: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        if (textNodeContainingQuery) {
          const nodeText = textNodeContainingQuery.getTextContent();
          const triggerStart = nodeText.lastIndexOf("{{");

          if (triggerStart >= 0) {
            const before = nodeText.slice(0, triggerStart);
            if (before) {
              textNodeContainingQuery.setTextContent(before);
              const pillNode = $createFhirPathPillNode(
                option.completionItem.insert_text,
              );
              textNodeContainingQuery.insertAfter(pillNode);
              pillNode.selectNext();
            } else {
              const pillNode = $createFhirPathPillNode(
                option.completionItem.insert_text,
              );
              textNodeContainingQuery.replace(pillNode);
              pillNode.selectNext();
            }
          }
        } else {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const pillNode = $createFhirPathPillNode(
              option.completionItem.insert_text,
            );
            selection.insertNodes([pillNode]);
            pillNode.selectNext();
          }
        }
      });
      closeMenu();
    },
    [editor],
  );

  const menuRenderFn: MenuRenderFn<FhirPathCompletionOption> = useCallback(
    (
      anchorElementRef,
      { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options },
    ) => {
      if (!anchorElementRef.current || options.length === 0) return null;

      return createPortal(
        <div className="fhirpath-autocomplete-menu">
          {options.map((option, i) => (
            <div
              key={option.key}
              ref={(el) => option.setRefElement(el)}
              className={`fhirpath-autocomplete-item${i === selectedIndex ? " selected" : ""}`}
              onClick={() => selectOptionAndCleanUp(option)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span className="item-label">
                {option.completionItem.label}
              </span>
              {option.completionItem.detail && (
                <span className="item-detail">
                  {option.completionItem.detail}
                </span>
              )}
              <span
                className={`item-kind item-kind-${option.completionItem.kind}`}
              >
                {option.completionItem.kind}
              </span>
            </div>
          ))}
        </div>,
        anchorElementRef.current,
      );
    },
    [],
  );

  if (!wasmQuestionnaireIndex || !contextExpression) return null;

  return (
    <LexicalTypeaheadMenuPlugin<FhirPathCompletionOption>
      options={options}
      triggerFn={fhirPathTriggerFn}
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      menuRenderFn={menuRenderFn}
      preselectFirstItem
    />
  );
}
