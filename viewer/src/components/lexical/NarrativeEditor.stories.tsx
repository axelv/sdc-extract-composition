import { useEffect, useMemo, useState } from "react";
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
import { WasmQuestionnaireIndexProvider } from "./WasmQuestionnaireIndexContext";

import questionnaireJson from "../../iterations/01-liquid-template/questionnaire-extract.json";

const SAMPLE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

const CONTEXT_PRESETS: Record<string, string> = {
  "Preop Anamnesis (preop-an)": "%resource.item.where(linkId='preop-an')",
  "Preop Clinical Exam (preop-ko)": "%resource.item.where(linkId='preop-ko')",
  "Root (%resource)": "%resource",
};

const SAMPLE_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml">
<dl>
  <dt>HAND</dt>
  <dd>{{%context.item.where(linkId='hand').answer.value}}</dd>
  <dt>klacht</dt>
  <dd>{{%context.item.where(linkId='klacht').answer.value}}</dd>
</dl>
</div>`;

const EMPTY_DIV_HTML = `<div xmlns="http://www.w3.org/1999/xhtml"><p></p></div>`;

interface NarrativeEditorHarnessProps {
  questionnaire: Questionnaire;
  contextExpression: string;
  divHtml: string;
}

function NarrativeEditorHarness({
  questionnaire,
  contextExpression,
  divHtml,
}: NarrativeEditorHarnessProps) {
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

  // Force remount so HtmlImportPlugin re-runs when inputs change.
  const editorKey = `${contextExpression}::${divHtml}`;

  return (
    <QuestionnaireIndexProvider value={jsIndex}>
      <WasmQuestionnaireIndexProvider value={wasmIndex}>
        <div className="max-w-3xl p-6 font-sans text-sm text-gray-900 space-y-3">
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
            open the autocomplete and pick a completion — a pill is inserted
            and the FHIRPATH editor opens below for refinement. Click an
            existing pill to edit its expression.
          </p>
        </div>
      </WasmQuestionnaireIndexProvider>
    </QuestionnaireIndexProvider>
  );
}

const meta: Meta<typeof NarrativeEditorHarness> = {
  title: "Lexical/NarrativeEditor",
  component: NarrativeEditorHarness,
  parameters: { layout: "fullscreen" },
  args: {
    questionnaire: SAMPLE_QUESTIONNAIRE,
    contextExpression: CONTEXT_PRESETS["Preop Anamnesis (preop-an)"],
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
