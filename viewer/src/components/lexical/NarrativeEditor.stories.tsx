import { useCallback, useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode } from "@lexical/rich-text";
import { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";

import type { Questionnaire } from "../../types";
import { buildQuestionnaireIndex } from "../../utils/questionnaire-index";
import { ensureWasmInit } from "../../utils/wasm-init";

import { FhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathAutocompletePlugin } from "./FhirPathAutocompletePlugin";
import { HtmlImportPlugin } from "./HtmlImportPlugin";
import { PillEditingWorkspace } from "./PillEditingWorkspace";
import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";
import { QuestionnaireProvider } from "./QuestionnaireContext";
import { WasmQuestionnaireIndexProvider } from "./WasmQuestionnaireIndexContext";

// Use the nested-choice-questions iteration: it has answerOption.valueCoding
// entries (with `system`+`code`+`display`) on the `laterality` linkId, so the
// SynonymsPanel has codes to surface for renaming.
import questionnaireJson from "../../../../iterations/03-nested-choice-questions/questionnaire-extract.json";

const SAMPLE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

const CONTEXT_PRESETS: Record<string, string> = {
  "Preop Clinical Exam (preop-ko)": "%resource.item.where(linkId='preop-ko')",
  "Preop Anamnesis (preop-an)": "%resource.item.where(linkId='preop-an')",
  "Root (%resource)": "%resource",
};

// References `laterality` (a choice with answerOption codings) so the
// SynonymsPanel has rename targets when this pill is selected.
const SAMPLE_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml">
<dl>
  <dt>Laterality</dt>
  <dd>{{%context.item.where(linkId='laterality').answer.value}}</dd>
  <dt>Drukpijn</dt>
  <dd>{{%context.item.where(linkId='drukpijn').answer.value}}</dd>
</dl>
</div>`;

const EMPTY_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml"><p></p></div>`;

const PARAGRAPHLESS_TEXT_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml">met behulp van een regadenoson stress test.</div>`;

const PARAGRAPHLESS_PILL_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml">met behulp van een {{%context.item.where(linkId='laterality').answer.value}} stress test.</div>`;

interface NarrativeEditorHarnessProps {
  questionnaire: Questionnaire;
  contextExpression: string;
  divHtml: string;
}

function NarrativeEditorHarness({
  questionnaire: initialQuestionnaire,
  contextExpression,
  divHtml,
}: NarrativeEditorHarnessProps) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(
    initialQuestionnaire,
  );

  // Resync if Storybook controls swap the upstream fixture.
  useEffect(() => {
    setQuestionnaire(initialQuestionnaire);
  }, [initialQuestionnaire]);

  const jsIndex = useMemo(
    () => buildQuestionnaireIndex(questionnaire),
    [questionnaire],
  );

  const [wasmIndex, setWasmIndex] = useState<WasmQuestionnaireIndex | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    ensureWasmInit().then(() => {
      if (cancelled) return;
      setWasmIndex(new WasmQuestionnaireIndex(JSON.stringify(questionnaire)));
    });
    return () => {
      cancelled = true;
    };
  }, [questionnaire]);

  const binding = useMemo(
    () => ({ questionnaire, setQuestionnaire }),
    [questionnaire],
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(questionnaire, null, 2)], {
      type: "application/fhir+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${questionnaire.id ?? "questionnaire"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [questionnaire]);

  // Force remount so HtmlImportPlugin re-runs when inputs change.
  // Note: we do NOT include `questionnaire` here so that supplement edits
  // mid-session don't blow away the user's editor state.
  const editorKey = `${contextExpression}::${divHtml}`;

  const supplementCount = useMemo(() => {
    const c = (questionnaire as unknown as { contained?: unknown[] }).contained;
    if (!Array.isArray(c)) return 0;
    return c.filter(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        (r as Record<string, unknown>).resourceType === "CodeSystem" &&
        (r as Record<string, unknown>).content === "supplement",
    ).length;
  }, [questionnaire]);

  return (
    <QuestionnaireProvider value={binding}>
      <QuestionnaireIndexProvider value={jsIndex}>
        <WasmQuestionnaireIndexProvider value={wasmIndex}>
          <div className="max-w-3xl p-6 font-sans text-sm text-gray-900 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                Context:{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {contextExpression}
                </code>
                {!wasmIndex && (
                  <span className="ml-2 text-amber-600">
                    (loading wasm autocomplete…)
                  </span>
                )}
                <span className="ml-2 text-gray-400">
                  {supplementCount} supplement
                  {supplementCount === 1 ? "" : "s"} attached
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50"
                title="Download the current Questionnaire JSON (with supplement edits)"
              >
                Download Questionnaire
              </button>
            </div>
            <LexicalComposer
              key={editorKey}
              initialConfig={{
                namespace: "NarrativeEditorStory",
                nodes: [HeadingNode, FhirPathPillNode],
                theme: {},
                onError: (e: Error) =>
                  console.error("[NarrativeEditorStory]", e),
              }}
            >
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="narrative-content min-h-[180px] outline-none p-3 border border-gray-200 rounded bg-white" />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <HtmlImportPlugin divHtml={divHtml} />
              <FhirPathAutocompletePlugin contextExpression={contextExpression} />
              <PillEditingWorkspace contextExpression={contextExpression} />
            </LexicalComposer>
            <p className="text-xs text-gray-500">
              Tip: type <code className="bg-gray-100 px-1 rounded">%</code> to
              open the autocomplete and pick a completion. Click an existing
              pill to open its FHIRPATH editor and the Synoniemen panel —
              codes reachable from the pill are listed there for renaming.
            </p>
          </div>
        </WasmQuestionnaireIndexProvider>
      </QuestionnaireIndexProvider>
    </QuestionnaireProvider>
  );
}

const meta: Meta<typeof NarrativeEditorHarness> = {
  title: "Lexical/NarrativeEditor",
  component: NarrativeEditorHarness,
  parameters: { layout: "fullscreen" },
  args: {
    questionnaire: SAMPLE_QUESTIONNAIRE,
    contextExpression: CONTEXT_PRESETS["Preop Clinical Exam (preop-ko)"],
    divHtml: SAMPLE_DIV_HTML,
  },
  argTypes: {
    questionnaire: { table: { disable: true } },
    contextExpression: {
      control: "select",
      options: Object.values(CONTEXT_PRESETS),
      description: "FHIRPath context passed to the autocomplete plugin",
    },
    divHtml: {
      control: "text",
      description: "Initial XHTML div imported into the Lexical editor",
    },
  },
};

export default meta;

type Story = StoryObj<typeof NarrativeEditorHarness>;

export const WithExistingPills: Story = {};

export const EmptyEditor: Story = {
  args: { divHtml: EMPTY_DIV_HTML },
};

export const RootContext: Story = {
  args: {
    contextExpression: CONTEXT_PRESETS["Root (%resource)"],
    divHtml: EMPTY_DIV_HTML,
  },
};

// Narrative content with raw text directly inside the outer xhtml <div> —
// no <p> or other block wrapper. The Lexical RootNode rejects bare TextNodes,
// so HtmlImportPlugin must group them into a paragraph during import.
export const ParagraphlessText: Story = {
  args: { divHtml: PARAGRAPHLESS_TEXT_DIV_HTML },
};

// Same as above but with an inline FHIRPath pill in the middle of the text.
// Exercises the wrap-inline-runs path with a mix of text and DecoratorNode.
export const ParagraphlessTextWithPill: Story = {
  args: { divHtml: PARAGRAPHLESS_PILL_DIV_HTML },
};
