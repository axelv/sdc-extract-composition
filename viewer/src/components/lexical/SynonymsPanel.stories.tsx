import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Questionnaire } from "../../types";
import { buildQuestionnaireIndex } from "../../utils/questionnaire-index";
import { setDesignation } from "../../utils/supplement-editor";
import { ensureWasmInit, useWasmReady } from "../../utils/wasm-init";

import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";
import {
  QuestionnaireProvider,
  type QuestionnaireBinding,
} from "./QuestionnaireContext";
import { SynonymsPanel } from "./SynonymsPanel";

import questionnaireJson from "../../../../iterations/03-nested-choice-questions/questionnaire-extract.json";

const BASE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

const LATERALITY_SYSTEM = "http://example.org/laterality";

// Iteration 03's `laterality` choice has answerOption codings (right/left)
// under this system, which `SynonymsPanel.collectCodings()` reads.
const LATERALITY_EXPRESSION =
  "%resource.item.where(linkId='laterality').answer.value";

const QUESTIONNAIRE_WITH_OVERRIDES: Questionnaire = (() => {
  let q = BASE_QUESTIONNAIRE;
  q = setDesignation(q, {
    system: LATERALITY_SYSTEM,
    code: "right",
    useToken: "override",
    value: "Rechts",
  });
  q = setDesignation(q, {
    system: LATERALITY_SYSTEM,
    code: "left",
    useToken: "override",
    value: "Linkerzijde",
  });
  return q;
})();

interface HarnessProps {
  initialQuestionnaire: Questionnaire;
  initialExpression: string;
  readonly?: boolean;
}

// Stable per-object identifier so the inner harness can be remounted when
// Storybook controls swap the questionnaire reference. WeakMap so test
// fixtures are GC'd with the module if it ever unloads.
const questionnaireIds = new WeakMap<Questionnaire, number>();
let nextQuestionnaireId = 0;
function questionnaireIdOf(q: Questionnaire): number {
  const existing = questionnaireIds.get(q);
  if (existing != null) return existing;
  const id = nextQuestionnaireId++;
  questionnaireIds.set(q, id);
  return id;
}

function SynonymsPanelHarness(props: HarnessProps) {
  const remountKey = `${questionnaireIdOf(props.initialQuestionnaire)}::${props.initialExpression}::${props.readonly ?? false}`;
  return <SynonymsPanelHarnessInner key={remountKey} {...props} />;
}

function SynonymsPanelHarnessInner({
  initialQuestionnaire,
  initialExpression,
  readonly = false,
}: HarnessProps) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(
    initialQuestionnaire,
  );
  // The panel no longer mutates the expression (overrides are stored as
  // supplements, not appended as `|| designation:` filters), so we use the
  // prop directly. Storybook control changes remount the inner via `key`.
  const expression = initialExpression;

  // Boot wasm so segmentExpression() (called inside the panel) can resolve
  // linkIds. The panel subscribes via useWasmReady and re-renders on flip.
  useEffect(() => {
    ensureWasmInit();
  }, []);
  const wasmReady = useWasmReady();

  const index = useMemo(
    () => buildQuestionnaireIndex(questionnaire),
    [questionnaire],
  );
  const binding = useMemo<QuestionnaireBinding>(
    () =>
      readonly
        ? { questionnaire }
        : { questionnaire, setQuestionnaire },
    [questionnaire, readonly],
  );

  const supplementCount = useMemo(
    () => countSupplementDesignations(questionnaire),
    [questionnaire],
  );

  return (
    <div className="max-w-2xl p-6 font-sans text-sm text-gray-900 space-y-3">
      <div className="text-xs text-gray-500 space-y-1">
        <div>
          Expression:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded break-all">
            {expression}
          </code>
        </div>
        <div>
          {supplementCount} designation
          {supplementCount === 1 ? "" : "s"} attached
          {!wasmReady && (
            <span className="ml-2 text-amber-600">(loading wasm…)</span>
          )}
          {readonly && (
            <span className="ml-2 text-gray-400">
              (binding has no setter — read-only)
            </span>
          )}
        </div>
      </div>
      <QuestionnaireProvider value={binding}>
        <QuestionnaireIndexProvider value={index}>
          <SynonymsPanel expression={expression} />
        </QuestionnaireIndexProvider>
      </QuestionnaireProvider>
    </div>
  );
}

function countSupplementDesignations(q: Questionnaire): number {
  const contained = (q as unknown as { contained?: unknown[] }).contained;
  if (!Array.isArray(contained)) return 0;
  let count = 0;
  for (const r of contained) {
    if (
      typeof r !== "object" ||
      r === null ||
      (r as Record<string, unknown>).resourceType !== "CodeSystem" ||
      (r as Record<string, unknown>).content !== "supplement"
    ) {
      continue;
    }
    const concepts = (r as { concept?: { designation?: unknown[] }[] }).concept;
    if (!Array.isArray(concepts)) continue;
    for (const c of concepts) {
      if (Array.isArray(c.designation)) count += c.designation.length;
    }
  }
  return count;
}

const meta: Meta<typeof SynonymsPanelHarness> = {
  title: "Lexical/SynonymsPanel",
  component: SynonymsPanelHarness,
  parameters: { layout: "fullscreen" },
  args: {
    initialQuestionnaire: BASE_QUESTIONNAIRE,
    initialExpression: LATERALITY_EXPRESSION,
    readonly: false,
  },
  argTypes: {
    initialQuestionnaire: { table: { disable: true } },
    initialExpression: {
      control: "text",
      description:
        "FHIRPath-like expression. The panel surfaces codings reachable from the referenced linkId.",
    },
    readonly: {
      control: "boolean",
      description:
        "When true, the QuestionnaireBinding is provided without a setter so the panel renders in read-only mode (overrides visible, no edit affordances).",
    },
  },
};

export default meta;

type Story = StoryObj<typeof SynonymsPanelHarness>;

export const Empty: Story = {};

export const WithOverrides: Story = {
  args: {
    initialQuestionnaire: QUESTIONNAIRE_WITH_OVERRIDES,
  },
};

export const ReadOnly: Story = {
  args: {
    initialQuestionnaire: QUESTIONNAIRE_WITH_OVERRIDES,
    readonly: true,
  },
};
