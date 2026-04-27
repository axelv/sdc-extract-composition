import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
  placeholder as placeholderExt,
} from "@codemirror/view";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  type CompletionSource,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  historyKeymap,
  history,
} from "@codemirror/commands";
import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import { getFhirPathCompletions } from "./fhirpath-completions";
import { useWasmQuestionnaireIndex } from "./WasmQuestionnaireIndexContext";

interface FhirPathExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  contextExpression?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
}

function buildCompletionSource(
  contextExpressionRef: React.MutableRefObject<string | null | undefined>,
  wasmIndexRef: React.MutableRefObject<WasmQuestionnaireIndex | null>,
): CompletionSource {
  return (ctx) => {
    const word = ctx.matchBefore(/%[\w]*/);
    if (!word) return null;
    if (word.from === word.to && !ctx.explicit) return null;

    const sliced = ctx.state.doc.sliceString(word.from, word.to);
    const query = sliced.slice(1).toLowerCase();

    const items = getFhirPathCompletions(
      contextExpressionRef.current,
      wasmIndexRef.current,
    );

    const options = items
      .filter(
        (c) => !query || c.filter_text.toLowerCase().includes(query),
      )
      .sort((a, b) => a.sort_text.localeCompare(b.sort_text))
      .map((c) => ({
        label: c.label,
        apply: c.insert_text,
        detail: c.detail ?? undefined,
        type: c.kind,
      }));

    return {
      from: word.from,
      options,
      validFor: /^%[\w]*$/,
    };
  };
}

const singleLineFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  if (tr.newDoc.lines > 1) return [];
  return tr;
});

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily:
      "'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
  },
  ".cm-content": {
    padding: "6px 8px",
    caretColor: "#111827",
  },
  ".cm-editor.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflowX: "auto",
  },
  ".cm-placeholder": {
    color: "#9ca3af",
    fontStyle: "italic",
  },
});

export function FhirPathExpressionEditor({
  value,
  onChange,
  contextExpression,
  autoFocus = true,
  placeholder = "FHIRPath expression…",
}: FhirPathExpressionEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const contextExpressionRef = useRef(contextExpression);
  const wasmIndex = useWasmQuestionnaireIndex();
  const wasmIndexRef = useRef<WasmQuestionnaireIndex | null>(wasmIndex);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    contextExpressionRef.current = contextExpression;
  }, [contextExpression]);
  useEffect(() => {
    wasmIndexRef.current = wasmIndex;
  }, [wasmIndex]);

  useEffect(() => {
    if (!hostRef.current) return;

    const completionSource = buildCompletionSource(
      contextExpressionRef,
      wasmIndexRef,
    );

    const extensions: Extension[] = [
      history(),
      drawSelection(),
      highlightActiveLine(),
      closeBrackets(),
      autocompletion({
        override: [completionSource],
        activateOnTyping: true,
        defaultKeymap: true,
      }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      singleLineFilter,
      placeholderExt(placeholder),
      editorTheme,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const next = update.state.doc.toString();
        onChangeRef.current(next);
      }),
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    if (autoFocus) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Editor is created once per mount; parent should re-key when switching
    // pills so a fresh state is initialized with the new expression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g., the pill expression was updated
  // somewhere else) without remounting. Skip if the doc already matches.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="fhirpath-expression-editor" />;
}
