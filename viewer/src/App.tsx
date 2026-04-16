import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import type { Composition, Questionnaire } from "./types";
import { extractComposition } from "./utils/extract-composition";
import { buildQuestionnaireIndex } from "./utils/questionnaire-index";
import { renderComposition } from "./utils/render-api";
import { QuestionnaireLoader } from "./components/QuestionnaireLoader";
import { QuestionnaireFormPanel } from "./components/QuestionnaireFormPanel";
import { CompositionTemplatePanel } from "./components/CompositionTemplatePanel";
import { RenderedOutputPanel } from "./components/RenderedOutputPanel";

function App() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(
    null
  );
  const [showContext, setShowContext] = useState(true);
  const [questionnaireResponse, setQuestionnaireResponse] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [composition, setComposition] = useState<Composition | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [renderLoading, setRenderLoading] = useState(false);

  // Derive composition from questionnaire
  useEffect(() => {
    setComposition(questionnaire ? extractComposition(questionnaire) : null);
  }, [questionnaire]);

  const questionnaireIndex = useMemo(
    () => (questionnaire ? buildQuestionnaireIndex(questionnaire) : undefined),
    [questionnaire]
  );

  // Clear QR when questionnaire changes
  const handleQuestionnaireLoad = useCallback((q: Questionnaire) => {
    setQuestionnaire(q);
    setQuestionnaireResponse(null);
    setRenderedHtml(null);
    setRenderErrors([]);
  }, []);

  const TEMPLATE_EXTRACT_CONTEXT_URL =
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

  // Navigate to a nested section by path indices
  const navigateToSection = (comp: Composition, path: number[]) => {
    let sections = comp.section;
    for (let i = 0; i < path.length - 1; i++) {
      sections = sections?.[path[i]]?.section;
    }
    return sections?.[path[path.length - 1]];
  };

  const handleSectionHtmlChange = useCallback(
    (sectionPath: number[], newDivHtml: string) => {
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const target = navigateToSection(updated, sectionPath);
        if (target?.text) {
          target.text.div = newDivHtml;
        }
        return updated;
      });
    },
    []
  );

  const handleContextExpressionChange = useCallback(
    (sectionPath: number[], newExpression: string) => {
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const target = navigateToSection(updated, sectionPath);
        if (target?.extension) {
          const ext = target.extension.find(
            (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
          );
          if (ext) ext.valueString = newExpression;
        }
        return updated;
      });
    },
    []
  );

  const handleAddSection = useCallback(
    (parentPath: number[]) => {
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const newSection = {
          title: "New Section",
          text: {
            status: "generated",
            div: '<div xmlns="http://www.w3.org/1999/xhtml"></div>',
          },
        };
        if (parentPath.length === 0) {
          updated.section = [...(updated.section ?? []), newSection];
        } else {
          const parent = navigateToSection(updated, parentPath);
          if (parent) {
            parent.section = [...(parent.section ?? []), newSection];
          }
        }
        return updated;
      });
    },
    []
  );

  const handleRemoveSection = useCallback(
    (sectionPath: number[]) => {
      if (sectionPath.length === 0) return;
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const index = sectionPath[sectionPath.length - 1];
        if (sectionPath.length === 1) {
          updated.section?.splice(index, 1);
        } else {
          const parentPath = sectionPath.slice(0, -1);
          const parent = navigateToSection(updated, parentPath);
          parent?.section?.splice(index, 1);
        }
        return updated;
      });
    },
    []
  );

  // Debounced render when QR or composition changes
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!composition || !questionnaireResponse) return;

    clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(async () => {
      setRenderLoading(true);
      try {
        const result = await renderComposition(
          composition as unknown as Record<string, unknown>,
          questionnaireResponse
        );
        setRenderedHtml(result.html);
        setRenderErrors(result.errors);
      } catch (err) {
        setRenderErrors([
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      } finally {
        setRenderLoading(false);
      }
    }, 300);

    return () => clearTimeout(renderTimeoutRef.current);
  }, [composition, questionnaireResponse]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-gray-900">
            Composition Template Viewer
          </h1>
          <QuestionnaireLoader onLoad={handleQuestionnaireLoad} />
        </div>
        {composition && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showContext}
              onChange={(e) => setShowContext(e.target.checked)}
              className="rounded border-gray-300"
            />
            Context
          </label>
        )}
      </header>

      {/* Panels */}
      {questionnaire && !composition && (
        <div className="m-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          No Composition found in Questionnaire.contained
        </div>
      )}

      {questionnaire && composition && (
        <PanelGroup orientation="horizontal" className="flex-1">
          <Panel defaultSize={30} minSize={15}>
            <QuestionnaireFormPanel
              questionnaire={questionnaire}
              onResponse={setQuestionnaireResponse}
              hasResponse={questionnaireResponse !== null}
            />
          </Panel>
          <PanelResizeHandle className="panel-resize-handle" />
          <Panel defaultSize={35} minSize={15}>
            <CompositionTemplatePanel
              composition={composition}
              questionnaireIndex={questionnaireIndex}
              showContext={showContext}
              onSectionHtmlChange={handleSectionHtmlChange}
              onContextExpressionChange={handleContextExpressionChange}
              onAddSection={handleAddSection}
              onRemoveSection={handleRemoveSection}
            />
          </Panel>
          <PanelResizeHandle className="panel-resize-handle" />
          <Panel defaultSize={35} minSize={15}>
            <RenderedOutputPanel
              html={renderedHtml}
              errors={renderErrors}
              loading={renderLoading}
            />
          </Panel>
        </PanelGroup>
      )}
    </div>
  );
}

export default App;
