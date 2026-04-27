import { useCallback, useRef, useState, useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode } from "@lexical/rich-text";
import { $generateHtmlFromNodes } from "@lexical/html";
import type { LexicalEditor } from "lexical";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";
import { analyzeContextType, CONTEXT_COLORS, CONTEXT_LABELS } from "../../utils/section-helpers";
import { useWasmQuestionnaireIndex } from "./WasmQuestionnaireIndexContext";
import { Modal } from "../Modal";
import { FhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathAutocompletePlugin } from "./FhirPathAutocompletePlugin";
import { HtmlImportPlugin } from "./HtmlImportPlugin";
import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

interface SectionEditorModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  divHtml: string;
  questionnaireIndex?: QuestionnaireIndex;
  contextExpression?: string | null;
  onSave: (newDivHtml: string, newTitle: string, newContextExpression: string) => void;
}

function editorConfig() {
  return {
    namespace: "SectionEditor",
    nodes: [HeadingNode, FhirPathPillNode],
    theme: {},
    onError: (error: Error) => console.error("[SectionEditor]", error),
  };
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  editorRef.current = editor;
  return null;
}

export function SectionEditorModal({
  open,
  onClose,
  title: initialTitle,
  divHtml,
  questionnaireIndex,
  contextExpression: initialContextExpression,
  onSave,
}: SectionEditorModalProps) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [contextExpression, setContextExpression] = useState(initialContextExpression ?? "");

  const wasmIndex = useWasmQuestionnaireIndex();

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? "");
      setContextExpression(initialContextExpression ?? "");
    }
  }, [open, initialTitle, initialContextExpression]);

  const contextType = analyzeContextType(contextExpression || null, wasmIndex);
  const contextColor = CONTEXT_COLORS[contextType];
  const contextLabel = CONTEXT_LABELS[contextType];

  const handleSave = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.read(() => {
      const html = $generateHtmlFromNodes(editor);
      const wrapped = `<div xmlns="${XHTML_NS}">${html}</div>`;
      onSave(wrapped, title, contextExpression);
    });
    onClose();
  }, [onSave, onClose, title, contextExpression]);

  if (!open) return null;

  return (
    <Modal title="Edit Section" onClose={onClose} open={open}>
      <QuestionnaireIndexProvider value={questionnaireIndex}>
        <div className="section-editor p-4">
          <div className="mb-3">
            <label htmlFor="context-expression" className="block text-xs font-medium text-gray-600 mb-1">
              Context Expression
            </label>
            <div className="flex gap-2 items-start">
              <input
                id="context-expression"
                type="text"
                value={contextExpression}
                onChange={(e) => setContextExpression(e.target.value)}
                placeholder="e.g. %resource.item.where(linkId='...')"
                className="flex-1 px-2 py-1.5 text-sm font-mono border border-gray-200 rounded outline-none focus:border-gray-400"
              />
              <span
                className="px-2 py-1 text-xs rounded whitespace-nowrap"
                style={{ backgroundColor: contextColor + "20", color: contextColor, border: `1px solid ${contextColor}` }}
              >
                {contextLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Leave empty for "Always". FHIRPath expression determines when this section renders.
            </p>
          </div>
          <div className="mb-3">
            <label htmlFor="section-title" className="block text-xs font-medium text-gray-600 mb-1">
              Title
            </label>
            <input
              id="section-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Section title"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-gray-400"
            />
          </div>
          <div className="mb-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Content
            </label>
          </div>
          <LexicalComposer initialConfig={editorConfig()}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="narrative-content min-h-[120px] outline-none p-2 border border-gray-200 rounded" />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <HtmlImportPlugin divHtml={divHtml} />
            <FhirPathAutocompletePlugin
              contextExpression={contextExpression}
            />
            <EditorRefPlugin editorRef={editorRef} />
          </LexicalComposer>
        </div>
      </QuestionnaireIndexProvider>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
