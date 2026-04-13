import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import type { Questionnaire } from "./types";
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
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [renderLoading, setRenderLoading] = useState(false);

  const composition = questionnaire
    ? extractComposition(questionnaire)
    : null;

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

  // Debounced render when QR or composition changes
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
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
