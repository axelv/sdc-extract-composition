import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import type { Composition, Questionnaire } from "./types";
import { extractComposition } from "./utils/extract-composition";
import { buildQuestionnaireIndex } from "./utils/questionnaire-index";
import { ensureWasmInit } from "./utils/wasm-init";
import { renderComposition } from "./utils/render-api";
import { QuestionnaireLoader } from "./components/QuestionnaireLoader";
import { QuestionnaireFormPanel } from "./components/QuestionnaireFormPanel";
import { CompositionTemplatePanel } from "./components/CompositionTemplatePanel";
import { RenderedOutputPanel } from "./components/RenderedOutputPanel";
import { WasmQuestionnaireIndexProvider } from "./components/lexical/WasmQuestionnaireIndexContext";

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

  const [wasmQuestionnaireIndex, setWasmQuestionnaireIndex] =
    useState<WasmQuestionnaireIndex | null>(null);

  useEffect(() => {
    if (!questionnaire) {
      setWasmQuestionnaireIndex(null);
      return;
    }
    let cancelled = false;
    ensureWasmInit().then(() => {
      if (cancelled) return;
      const idx = new WasmQuestionnaireIndex(JSON.stringify(questionnaire));
      setWasmQuestionnaireIndex(idx);
    });
    return () => { cancelled = true; };
  }, [questionnaire]);

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

  const handleSectionTitleChange = useCallback(
    (sectionPath: number[], newTitle: string) => {
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const target = navigateToSection(updated, sectionPath);
        if (target) {
          target.title = newTitle || undefined;
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
        if (!target) return updated;

        if (!newExpression) {
          // Remove the extension entry
          if (target.extension) {
            target.extension = target.extension.filter(
              (e) => e.url !== TEMPLATE_EXTRACT_CONTEXT_URL
            );
            if (target.extension.length === 0) delete target.extension;
          }
        } else {
          const ext = target.extension?.find(
            (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
          );
          if (ext) {
            ext.valueString = newExpression;
          } else {
            target.extension = [
              ...(target.extension ?? []),
              { url: TEMPLATE_EXTRACT_CONTEXT_URL, valueString: newExpression },
            ];
          }
        }
        return updated;
      });
    },
    []
  );

  const handleAddSection = useCallback(
    (parentPath: number[], insertIndex?: number) => {
      setComposition((prev) => {
        if (!prev) return prev;
        const updated = structuredClone(prev);
        const newSection = {
          title: "",
          text: {
            status: "generated" as const,
            div: '<div xmlns="http://www.w3.org/1999/xhtml"></div>',
          },
        };
        if (parentPath.length === 0) {
          const sections = updated.section ?? [];
          if (insertIndex !== undefined) {
            sections.splice(insertIndex, 0, newSection);
            updated.section = sections;
          } else {
            updated.section = [...sections, newSection];
          }
        } else {
          const parent = navigateToSection(updated, parentPath);
          if (parent) {
            const sections = parent.section ?? [];
            if (insertIndex !== undefined) {
              sections.splice(insertIndex, 0, newSection);
              parent.section = sections;
            } else {
              parent.section = [...sections, newSection];
            }
          }
        }
        return updated;
      });
    },
    []
  );

  const handleSectionChange = useCallback(
    (
      sectionPath: number[],
      newDivHtml: string,
      newTitle: string,
      newContextExpression: string
    ) => {
      handleSectionHtmlChange(sectionPath, newDivHtml);
      handleSectionTitleChange(sectionPath, newTitle);
      handleContextExpressionChange(sectionPath, newContextExpression);
    },
    [handleSectionHtmlChange, handleSectionTitleChange, handleContextExpressionChange]
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
        <WasmQuestionnaireIndexProvider value={wasmQuestionnaireIndex}>
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
                onSectionTitleChange={handleSectionTitleChange}
                onContextExpressionChange={handleContextExpressionChange}
                onAddSection={handleAddSection}
                onRemoveSection={handleRemoveSection}
                onSectionChange={handleSectionChange}
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
        </WasmQuestionnaireIndexProvider>
      )}
    </div>
  );
}

export default App;
