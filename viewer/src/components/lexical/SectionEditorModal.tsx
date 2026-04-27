import { useCallback, useRef, useState, useEffect, useMemo } from "react";
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
import { CONTEXT_COLORS } from "../../utils/section-helpers";
import { Modal } from "../Modal";
import { FhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathAutocompletePlugin } from "./FhirPathAutocompletePlugin";
import { HtmlImportPlugin } from "./HtmlImportPlugin";
import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";
import { PillEditingWorkspace } from "./PillEditingWorkspace";

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

type ContextMode = "always" | "conditional" | "repeating" | "custom";

function parseContextMode(expr: string | null | undefined): { mode: ContextMode; itemPath: string | null } {
  if (!expr || expr.trim() === "") {
    return { mode: "always", itemPath: null };
  }

  // Check for conditional pattern: ends with .exists()
  if (expr.endsWith(".exists()")) {
    const itemPath = expr.slice(0, -".exists()".length);
    return { mode: "conditional", itemPath };
  }

  // Check for repeating pattern: item path without .exists()
  // Must be a valid item path (contains .item.where(linkId=...))
  if (expr.includes(".item.where(linkId=") && !expr.includes(".exists()")) {
    return { mode: "repeating", itemPath: expr };
  }

  // Anything else is custom
  return { mode: "custom", itemPath: null };
}

function buildExpression(mode: ContextMode, itemPath: string | null, customExpr: string): string {
  switch (mode) {
    case "always":
      return "";
    case "conditional":
      return itemPath ? `${itemPath}.exists()` : "";
    case "repeating":
      return itemPath ?? "";
    case "custom":
      return customExpr;
  }
}

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

  // Parse initial expression to determine mode and itemPath
  const initialParsed = useMemo(
    () => parseContextMode(initialContextExpression),
    [initialContextExpression]
  );

  const [contextMode, setContextMode] = useState<ContextMode>(initialParsed.mode);
  const [selectedItemPath, setSelectedItemPath] = useState<string | null>(initialParsed.itemPath);
  const [customExpression, setCustomExpression] = useState(
    initialParsed.mode === "custom" ? (initialContextExpression ?? "") : ""
  );

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? "");
      const parsed = parseContextMode(initialContextExpression);
      setContextMode(parsed.mode);
      setSelectedItemPath(parsed.itemPath);
      setCustomExpression(parsed.mode === "custom" ? (initialContextExpression ?? "") : "");
    }
  }, [open, initialTitle, initialContextExpression]);

  // Build the actual expression from current state
  const contextExpression = buildExpression(contextMode, selectedItemPath, customExpression);

  // Get list of questionnaire items for dropdowns (with full paths)
  const questionnaireItems = useMemo(() => {
    if (!questionnaireIndex) return [];
    return Array.from(questionnaireIndex.items.entries()).map(([linkId, info]) => ({
      linkId,
      text: info.text,
      type: info.type,
      path: info.path,
    }));
  }, [questionnaireIndex]);

  // Filter for repeating items (groups that can contain multiple responses)
  const repeatingItems = useMemo(() => {
    return questionnaireItems.filter(item =>
      item.type === "group" || item.type === "choice" || item.type === "open-choice"
    );
  }, [questionnaireItems]);

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
    { mode: "conditional", label: "If exists", icon: "⎇" },
    { mode: "repeating", label: "For each", icon: "↻" },
    { mode: "custom", label: "Custom", icon: "{}" },
  ];

  return (
    <Modal title="Edit Section" onClose={onClose} open={open}>
      <QuestionnaireIndexProvider value={questionnaireIndex}>
        <div className="section-editor p-4">
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Context
            </label>
            {/* Mode buttons */}
            <div className="flex gap-1 mb-2">
              {modeButtons.map(({ mode, label, icon }) => {
                const isActive = contextMode === mode;
                const color = CONTEXT_COLORS[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setContextMode(mode);
                      if (mode === "always") {
                        setSelectedItemPath(null);
                      }
                    }}
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

            {/* Conditional mode: show item dropdown */}
            {contextMode === "conditional" && (
              <div className="mb-2">
                <select
                  value={selectedItemPath ?? ""}
                  onChange={(e) => setSelectedItemPath(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-gray-400"
                >
                  <option value="">Select an item...</option>
                  {questionnaireItems.map((item) => (
                    <option key={item.linkId} value={item.path}>
                      {item.text} ({item.linkId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Repeating mode: show repeating items dropdown */}
            {contextMode === "repeating" && (
              <div className="mb-2">
                <select
                  value={selectedItemPath ?? ""}
                  onChange={(e) => setSelectedItemPath(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-gray-400"
                >
                  <option value="">Select a repeating group...</option>
                  {repeatingItems.map((item) => (
                    <option key={item.linkId} value={item.path}>
                      {item.text} ({item.linkId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom mode: show editable FHIRPath input */}
            {contextMode === "custom" && (
              <div className="mb-2">
                <input
                  type="text"
                  value={customExpression}
                  onChange={(e) => setCustomExpression(e.target.value)}
                  placeholder="e.g. %resource.item.where(linkId='...')"
                  className="w-full px-2 py-1.5 text-sm font-mono border border-gray-200 rounded outline-none focus:border-gray-400"
                />
              </div>
            )}

            {/* Show readonly expression for conditional/repeating */}
            {(contextMode === "conditional" || contextMode === "repeating") && contextExpression && (
              <div className="px-2 py-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded text-gray-500">
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
            <PillEditingWorkspace contextExpression={contextExpression} />
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
