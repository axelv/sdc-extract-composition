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
import {
  parseContextExpression,
  formatContextExpression,
  type ContextConfig,
  type ContextMode,
  type Condition,
  type CombineMode,
} from "../../utils/context-expression";
import { CONTEXT_COLORS } from "../../utils/section-helpers";
import { Modal } from "../Modal";
import { FhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathAutocompletePlugin } from "./FhirPathAutocompletePlugin";
import { HtmlImportPlugin } from "./HtmlImportPlugin";
import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";
import { PillEditingWorkspace } from "./PillEditingWorkspace";
import { FormulaBar } from "./FormulaBar";
import { ConditionBuilder } from "../ConditionBuilder";
import { ForEachSelector } from "../ForEachSelector";
import { useDebugMode } from "../../contexts/DebugContext";

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
  const debugMode = useDebugMode();
  const editorRef = useRef<LexicalEditor | null>(null);
  const [title, setTitle] = useState(initialTitle ?? "");

  // Parse initial expression into config
  const [contextConfig, setContextConfig] = useState<ContextConfig>(() =>
    parseContextExpression(initialContextExpression ?? "")
  );

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? "");
      setContextConfig(parseContextExpression(initialContextExpression ?? ""));
    }
  }, [open, initialTitle, initialContextExpression]);

  // Build the actual expression from current config
  const contextExpression = formatContextExpression(contextConfig);

  const handleModeChange = useCallback((mode: ContextMode) => {
    switch (mode) {
      case "always":
        setContextConfig({ mode: "always" });
        break;
      case "if":
        setContextConfig({ mode: "if", combineMode: "and", conditions: [] });
        break;
      case "for-each":
        setContextConfig({ mode: "for-each", linkId: "" });
        break;
      case "custom":
        setContextConfig({ mode: "custom", expression: contextExpression });
        break;
    }
  }, [contextExpression]);

  const handleConditionsChange = useCallback(
    (conditions: Condition[], combineMode: CombineMode) => {
      setContextConfig({ mode: "if", combineMode, conditions });
    },
    []
  );

  const handleForEachChange = useCallback((linkId: string, scope: "context" | "resource") => {
    setContextConfig({ mode: "for-each", linkId, scope });
  }, []);

  const handleCustomChange = useCallback((expression: string) => {
    setContextConfig({ mode: "custom", expression });
  }, []);

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

  const modeButtons: { mode: ContextMode; label: string; icon: string }[] = [
    { mode: "always", label: "Always", icon: "—" },
    { mode: "if", label: "If", icon: "∟" },
    { mode: "for-each", label: "For each", icon: "↻" },
    { mode: "custom", label: "Custom", icon: "{}" },
  ];

  return (
    <Modal title="Edit Section" onClose={onClose} open={open}>
      <div className="section-editor-modal">
      <QuestionnaireIndexProvider value={questionnaireIndex}>
        <div className="section-editor p-4">
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Context
            </label>
            {/* Mode buttons */}
            <div className="flex gap-1 mb-2">
              {modeButtons.map(({ mode, label, icon }) => {
                const isActive = contextConfig.mode === mode;
                const color = CONTEXT_COLORS[mode] ?? CONTEXT_COLORS["always"];
                return (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className="px-3 py-1.5 text-xs rounded border transition-colors"
                    style={{
                      backgroundColor: isActive ? color + "20" : "transparent",
                      borderColor: isActive ? color : "#e5e7eb",
                      color: isActive ? color : "#6b7280",
                    }}
                  >
                    <span className="mr-1">{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* If mode: show condition builder */}
            {contextConfig.mode === "if" && (
              <ConditionBuilder
                conditions={contextConfig.conditions}
                combineMode={contextConfig.combineMode}
                questionnaireIndex={questionnaireIndex}
                onChange={handleConditionsChange}
              />
            )}

            {/* For each mode: show repeating items dropdown */}
            {contextConfig.mode === "for-each" && (
              <div className="mb-2">
                <ForEachSelector
                  value={contextConfig.linkId}
                  scope={contextConfig.scope}
                  questionnaireIndex={questionnaireIndex}
                  contextExpression={initialContextExpression}
                  onChange={handleForEachChange}
                />
              </div>
            )}

            {/* Custom mode: show editable FHIRPath input */}
            {contextConfig.mode === "custom" && (
              <div className="mb-2">
                <input
                  type="text"
                  value={contextConfig.expression}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g. %context.where(...)"
                  className="w-full px-2 py-1.5 text-sm font-mono border border-gray-200 rounded outline-none focus:border-gray-400"
                />
              </div>
            )}

            {/* Show readonly expression for if/for-each only in debug mode */}
            {debugMode && (contextConfig.mode === "if" || contextConfig.mode === "for-each") && contextExpression && (
              <div className="mt-2 px-2 py-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded text-gray-500">
                {contextExpression}
              </div>
            )}
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
            <div className="content-wrapper">
              <FormulaBar />
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="narrative-content min-h-[120px] outline-none p-2" />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
            <HistoryPlugin />
            <HtmlImportPlugin divHtml={divHtml} />
            <FhirPathAutocompletePlugin
              contextExpression={contextExpression}
            />
            <EditorRefPlugin editorRef={editorRef} />
            <PillEditingWorkspace />
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
      </div>
    </Modal>
  );
}
