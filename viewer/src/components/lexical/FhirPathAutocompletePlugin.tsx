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
  $createNodeSelection,
  $setSelection,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { useWasmQuestionnaireIndex } from "./WasmQuestionnaireIndexContext";
import { $createFhirPathPillNode } from "./FhirPathPillNode";
import {
  getFhirPathCompletions,
  type CompletionItem,
} from "./fhirpath-completions";

class FhirPathCompletionOption extends MenuOption {
  completionItem: CompletionItem;

  constructor(item: CompletionItem) {
    super(item.label);
    this.completionItem = item;
  }
}

/**
 * Trigger activates when a `%<query>` token sits immediately before the caret.
 * `replaceableString` keeps the leading `%` so the split yields a non-empty
 * TextNode (zero-width splits break `onSelectOption`).
 */
function percentTriggerFn(
  text: string,
  _editor: LexicalEditor,
): MenuTextMatch | null {
  const match = text.match(/%(\w*)$/);
  if (!match || match.index === undefined) return null;
  return {
    leadOffset: match.index,
    matchingString: match[1],
    replaceableString: match[0],
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

  const allCompletions = useMemo<CompletionItem[]>(
    () => getFhirPathCompletions(contextExpression, wasmQuestionnaireIndex),
    [wasmQuestionnaireIndex, contextExpression],
  );

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
        // TextNode. Swap the whole chunk for a pill, then select the pill so
        // PillEditingWorkspace opens the side editor for refinement.
        const pill = $createFhirPathPillNode(option.completionItem.insert_text);
        textNodeContainingQuery.replace(pill);
        const selection = $createNodeSelection();
        selection.add(pill.getKey());
        $setSelection(selection);
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
