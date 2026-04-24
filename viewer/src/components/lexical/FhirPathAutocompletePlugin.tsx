import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { LexicalEditor, TextNode } from "lexical";
import { useWasmQuestionnaireIndex } from "./WasmQuestionnaireIndexContext";

interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
}

/**
 * Stub variable completions — always available when inside an unclosed `{{`.
 * `insert_text` is the part after `%` since the user has already typed it.
 */
const STUB_COMPLETIONS: CompletionItem[] = [
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

class FhirPathCompletionOption extends MenuOption {
  completionItem: CompletionItem;

  constructor(item: CompletionItem) {
    super(item.label);
    this.completionItem = item;
  }
}

/**
 * Trigger activates only when the caret is inside an unclosed `{{` and the
 * typed query after the most recent `%` is `\w*`. `replaceableString`
 * intentionally includes the `%` so Lexical's split yields a non-empty
 * TextNode — zero-width splits break `onSelectOption`. `matchingString`
 * remains the query alone (used for filter only).
 */
function percentTriggerFn(
  text: string,
  _editor: LexicalEditor,
): MenuTextMatch | null {
  const openIdx = text.lastIndexOf("{{");
  if (openIdx === -1) return null;
  const closeIdx = text.lastIndexOf("}}");
  if (closeIdx > openIdx) return null;

  const afterOpen = text.slice(openIdx + 2);
  const percentIdx = afterOpen.lastIndexOf("%");
  if (percentIdx === -1) return null;

  const query = afterOpen.slice(percentIdx + 1);
  if (!/^\w*$/.test(query)) return null;

  const absPercentIdx = openIdx + 2 + percentIdx;
  return {
    leadOffset: absPercentIdx,
    matchingString: query,
    replaceableString: "%" + query,
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
    const wasm: CompletionItem[] = [];
    if (wasmQuestionnaireIndex && contextExpression) {
      try {
        const items = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        wasm.push(...items);
      } catch (e) {
        console.error("[FhirPathAutocomplete]", e);
      }
    }
    return [...STUB_COMPLETIONS, ...wasm];
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
        if (!textNodeContainingQuery) return;
        // `splitNodeContainingQuery` isolated the `%<query>` chunk into this
        // TextNode. Replace its whole content with the chosen completion.
        const inserted = option.completionItem.insert_text;
        textNodeContainingQuery.setTextContent(inserted);
        textNodeContainingQuery.select(inserted.length, inserted.length);
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

  return (
    <LexicalTypeaheadMenuPlugin<FhirPathCompletionOption>
      options={options}
      triggerFn={percentTriggerFn}
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      menuRenderFn={menuRenderFn}
      preselectFirstItem
    />
  );
}
