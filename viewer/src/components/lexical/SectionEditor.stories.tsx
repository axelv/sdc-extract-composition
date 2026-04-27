import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";

import type { Composition, CompositionSection, Questionnaire } from "../../types";
import { SectionBlockNode } from "./SectionBlockNode";
import { SectionBlocksPlugin } from "./SectionBlocksPlugin";
import { SectionsChangePlugin } from "./SectionsChangePlugin";
import { SectionsImportPlugin } from "./SectionsImportPlugin";

import questionnaireJson from "../../../../iterations/07-coloscopie/questionnaire-extract.json";

const COLOSCOPIE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

function findComposition(q: Questionnaire): Composition | null {
  for (const c of q.contained ?? []) {
    if ((c as Composition).resourceType === "Composition") {
      return c as Composition;
    }
  }
  return null;
}

const COLOSCOPIE_SECTIONS: CompositionSection[] =
  findComposition(COLOSCOPIE_QUESTIONNAIRE)?.section ?? [];

const STORY_STYLES = `
.section-tree { font-family: ui-sans-serif, system-ui, sans-serif; }
.section-tree .section-block {
  padding: 4px 8px;
  border-left: 2px solid transparent;
  border-radius: 4px;
  min-height: 1.5rem;
}
.section-tree .section-block:hover { border-left-color: #93c5fd; }
.section-tree .section-block .section-block {
  margin-left: 1.25rem;
  margin-top: 2px;
}
.section-tree .section-block:empty::before {
  content: "Empty section";
  color: #9ca3af;
  font-style: italic;
}
`;

interface SectionEditorHarnessProps {
  initialSections: CompositionSection[];
  storyKey: string;
}

function SectionEditorHarness({
  initialSections,
  storyKey,
}: SectionEditorHarnessProps) {
  const [sections, setSections] = useState<CompositionSection[]>(initialSections);

  return (
    <div className="p-6 text-sm text-gray-900">
      <style>{STORY_STYLES}</style>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Editor — Tab nests, Shift+Tab outdents, Enter creates a sibling.
          </div>
          <LexicalComposer
            key={storyKey}
            initialConfig={{
              namespace: "SectionEditorStory",
              nodes: [SectionBlockNode],
              theme: {},
              onError: (e: Error) => console.error("[SectionEditorStory]", e),
            }}
          >
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="section-tree min-h-[400px] outline-none p-3 border border-gray-200 rounded bg-white" />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <SectionBlocksPlugin />
            <SectionsImportPlugin sections={initialSections} />
            <SectionsChangePlugin onChange={setSections} />
          </LexicalComposer>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Live <code className="bg-gray-100 px-1 rounded">CompositionSection[]</code>
          </div>
          <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-[600px]">
            {JSON.stringify(sections, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof SectionEditorHarness> = {
  title: "Lexical/SectionEditor",
  component: SectionEditorHarness,
  parameters: { layout: "fullscreen" },
  argTypes: {
    initialSections: { table: { disable: true } },
    storyKey: { table: { disable: true } },
  },
};

export default meta;

type Story = StoryObj<typeof SectionEditorHarness>;

export const Coloscopie: Story = {
  args: {
    initialSections: COLOSCOPIE_SECTIONS,
    storyKey: "coloscopie",
  },
};

export const Empty: Story = {
  args: {
    initialSections: [],
    storyKey: "empty",
  },
};
