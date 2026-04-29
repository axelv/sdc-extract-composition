import { useCallback, useState } from "react";
import type { Composition } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { CompositionView } from "./CompositionView";
import { RawCompositionView } from "./RawCompositionView";
import { EditorView } from "./EditorView";
import { AnalyzeExpressionDebug } from "./AnalyzeExpressionDebug";

interface CompositionTemplatePanelProps {
  composition: Composition;
  questionnaireIndex?: QuestionnaireIndex;
  showContext?: boolean;
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
  showContext = true,
  onSectionHtmlChange,
  onSectionTitleChange,
  onContextExpressionChange,
  onAddSection,
  onRemoveSection,
  onSectionChange,
}: CompositionTemplatePanelProps) {
  const [showJson, setShowJson] = useState(false);

  const handleExport = useCallback(() => {
    const filename = `${composition.id ?? "composition"}.json`;
    downloadJson(composition, filename);
  }, [composition]);

  // Reserved for future tab restoration
  void [CompositionView, RawCompositionView, AnalyzeExpressionDebug, showContext, onSectionHtmlChange, onSectionTitleChange, onContextExpressionChange];

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Composition</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowJson(!showJson)}
            className={`panel-header-btn ${showJson ? "active" : ""}`}
            title="Toggle JSON view"
          >
            {"{ }"}
          </button>
          <button
            onClick={handleExport}
            className="panel-header-btn"
            title="Export Composition as JSON"
          >
            Export
          </button>
        </div>
      </div>
      <div className="panel-body">
        {showJson ? (
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(composition, null, 2)}
          </pre>
        ) : (
          onSectionChange && onAddSection && onRemoveSection && (
            <EditorView
              composition={composition}
              questionnaireIndex={questionnaireIndex}
              onSectionChange={onSectionChange}
              onAddSection={onAddSection}
              onRemoveSection={onRemoveSection}
            />
          )
        )}
      </div>
    </div>
  );
}
