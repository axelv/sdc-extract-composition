import { useCallback, useRef } from "react";
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
import { Modal } from "../Modal";
import { FhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathAutocompletePlugin } from "./FhirPathAutocompletePlugin";
import { HtmlImportPlugin } from "./HtmlImportPlugin";
import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

interface NarrativeEditorModalProps {
  open: boolean;
  onClose: () => void;
  divHtml: string;
  questionnaireIndex?: QuestionnaireIndex;
  contextExpression?: string | null;
  onSave: (newDivHtml: string) => void;
}

function editorConfig() {
  return {
    namespace: "NarrativeEditor",
    nodes: [HeadingNode, FhirPathPillNode],
    theme: {},
    onError: (error: Error) => console.error("[NarrativeEditor]", error),
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

export function NarrativeEditorModal({
  open,
  onClose,
  divHtml,
  questionnaireIndex,
  contextExpression,
  onSave,
}: NarrativeEditorModalProps) {
  const editorRef = useRef<LexicalEditor | null>(null);

  const handleSave = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.read(() => {
      const html = $generateHtmlFromNodes(editor);
      const wrapped = `<div xmlns="${XHTML_NS}">${html}</div>`;
      onSave(wrapped);
    });
    onClose();
  }, [onSave, onClose]);

  if (!open) return null;

  return (
    <Modal title="Edit Section" onClose={onClose} open={open}>
      <QuestionnaireIndexProvider value={questionnaireIndex}>
        <div className="narrative-editor p-4">
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
