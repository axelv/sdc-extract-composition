import { useCallback, useState } from "react";
import type { Composition } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { CompositionView } from "./CompositionView";
import { RawCompositionView } from "./RawCompositionView";
import { EditorView } from "./EditorView";
import { AnalyzeExpressionDebug } from "./AnalyzeExpressionDebug";

type Tab = "template" | "editor" | "structure" | "debug";

interface CompositionTemplatePanelProps {
  composition: Composition;
  questionnaireIndex?: QuestionnaireIndex;
  showContext: boolean;
  onSectionHtmlChange?: (sectionPath: number[], newDivHtml: string) => void;
  onSectionTitleChange?: (sectionPath: number[], newTitle: string) => void;
  onContextExpressionChange?: (sectionPath: number[], newExpression: string) => void;
  onAddSection?: (parentPath: number[], insertIndex?: number) => void;
  onRemoveSection?: (sectionPath: number[]) => void;
  onSectionChange?: (
    sectionPath: number[],
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => void;
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompositionTemplatePanel({
  composition,
  questionnaireIndex,
  showContext,
  onSectionHtmlChange,
  onSectionTitleChange,
  onContextExpressionChange,
  onAddSection,
  onRemoveSection,
  onSectionChange,
}: CompositionTemplatePanelProps) {
  const [tab, setTab] = useState<Tab>("template");

  const handleExport = useCallback(() => {
    const filename = `${composition.id ?? "composition"}.json`;
    downloadJson(composition, filename);
  }, [composition]);

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Template</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            {(["template", "editor", "structure", "debug"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  tab === t
                    ? "bg-white shadow-sm text-gray-900 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "template" ? "Template" : t === "editor" ? "Editor" : t === "structure" ? "Structure" : "Debug"}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            title="Export Composition as JSON"
          >
            Export
          </button>
        </div>
      </div>
      <div className="panel-body">
        {tab === "template" && (
          <CompositionView
            composition={composition}
            questionnaireIndex={questionnaireIndex}
            showContext={showContext}
            onSectionHtmlChange={onSectionHtmlChange}
            onSectionTitleChange={onSectionTitleChange}
            onContextExpressionChange={onContextExpressionChange}
            onAddSection={onAddSection}
            onRemoveSection={onRemoveSection}
          />
        )}
        {tab === "editor" && onSectionChange && onAddSection && onRemoveSection && (
          <EditorView
            composition={composition}
            questionnaireIndex={questionnaireIndex}
            onSectionChange={onSectionChange}
            onAddSection={onAddSection}
            onRemoveSection={onRemoveSection}
          />
        )}
        {tab === "structure" && (
          <RawCompositionView composition={composition} />
        )}
        {tab === "debug" && (
          <AnalyzeExpressionDebug />
        )}
      </div>
    </div>
  );
}
