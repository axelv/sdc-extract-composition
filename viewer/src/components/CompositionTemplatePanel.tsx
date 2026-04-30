import { useCallback, useRef, useState } from "react";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
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
  onClearSections?: () => void;
  onImportComposition?: (composition: Composition) => void;
  onSectionChange?: (
    sectionPath: number[],
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => void;
  onAIQuickStart?: (preset?: string) => void;
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
  onClearSections,
  onImportComposition,
  onSectionChange,
  onAIQuickStart,
}: CompositionTemplatePanelProps) {
  const [showJson, setShowJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const filename = `${composition.id ?? "composition"}.json`;
    downloadJson(composition, filename);
  }, [composition]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImportComposition) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.resourceType === "Composition") {
            onImportComposition(parsed as Composition);
          }
        } catch {
          // ignore invalid JSON
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImportComposition]
  );

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
          {onClearSections && (
            <button
              onClick={onClearSections}
              className="panel-header-btn"
              title="Clear all sections"
            >
              Clear
            </button>
          )}
          {onImportComposition && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="panel-header-btn"
                title="Import Composition from JSON"
              >
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
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
          <div className="text-xs">
            <JsonView data={composition} style={defaultStyles} />
          </div>
        ) : (
          onSectionChange && onAddSection && onRemoveSection && (
            <EditorView
              composition={composition}
              questionnaireIndex={questionnaireIndex}
              onSectionChange={onSectionChange}
              onAddSection={onAddSection}
              onRemoveSection={onRemoveSection}
              onAIQuickStart={onAIQuickStart}
            />
          )
        )}
      </div>
    </div>
  );
}
