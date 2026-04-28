import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Questionnaire } from "../../types";
import { buildQuestionnaireIndex } from "../../utils/questionnaire-index";
import { ensureWasmInit, useWasmReady } from "../../utils/wasm-init";
import { inferAnswerShape } from "../../utils/expression-type";

import { QuestionnaireIndexProvider } from "./QuestionnaireIndexContext";
import { FormattingPanel } from "./FormattingPanel";

import iter03 from "../../iterations/03-nested-choice-questions/questionnaire-extract.json";
import iter05 from "../../iterations/05-pathology/questionnaire-extract.json";
import iter08editor from "../../iterations/08-editor-test/questionnaire-extract.json";

const Q_CHOICE = iter03 as unknown as Questionnaire;
const Q_PATHOLOGY = iter05 as unknown as Questionnaire;
const Q_EDITOR = iter08editor as unknown as Questionnaire;

interface HarnessProps {
  questionnaire: Questionnaire;
  initialExpression: string;
  readonly?: boolean;
}

function FormattingPanelHarness(props: HarnessProps) {
  // Remount when the controls change so the editor state is reset cleanly.
  const key = `${props.initialExpression}::${props.readonly ?? false}`;
  return <FormattingPanelHarnessInner key={key} {...props} />;
}

function FormattingPanelHarnessInner({
  questionnaire,
  initialExpression,
  readonly = false,
}: HarnessProps) {
  const [expression, setExpression] = useState(initialExpression);

  useEffect(() => {
    ensureWasmInit();
  }, []);
  const wasmReady = useWasmReady();

  const index = useMemo(
    () => buildQuestionnaireIndex(questionnaire),
    [questionnaire],
  );

  // wasmReady is in deps because inferAnswerShape() relies on the wasm
  // analyzer to extract linkIds from the expression head — without it, the
  // detected shape stays `unknown`. Reading wasmReady in deps forces the
  // memo to recompute once the analyzer flips ready.
  const shape = useMemo(
    () => inferAnswerShape(expression, index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expression, index, wasmReady],
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
          Detected shape:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded">
            {shape?.valueShape ?? "unknown"}
          </code>
          {shape?.itemType && (
            <>
              {" "}
              (item.type ={" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                {shape.itemType}
              </code>
              )
            </>
          )}
          {!wasmReady && (
            <span className="ml-2 text-amber-600">(loading wasm…)</span>
          )}
          {readonly && (
            <span className="ml-2 text-gray-400">(read-only)</span>
          )}
        </div>
      </div>
      <QuestionnaireIndexProvider value={index}>
        <FormattingPanel
          expression={expression}
          shape={shape}
          onChange={readonly ? undefined : setExpression}
        />
      </QuestionnaireIndexProvider>
    </div>
  );
}

const STRING_EXPR =
  "%resource.item.where(linkId='patient-name').answer.value";
const DATE_EXPR =
  "%resource.item.where(linkId='patient-dob').answer.value";
const INTEGER_EXPR =
  "%context.item.where(linkId='lymph-nodes-examined').answer.value";
const DECIMAL_EXPR =
  "%context.item.where(linkId='specimen-length').answer.value";
const CODING_EXPR =
  "%resource.item.where(linkId='laterality').answer.value";
const UNKNOWN_EXPR = "Patient.name.given";

const meta: Meta<typeof FormattingPanelHarness> = {
  title: "Lexical/FormattingPanel",
  component: FormattingPanelHarness,
  parameters: { layout: "fullscreen" },
  args: {
    questionnaire: Q_EDITOR,
    initialExpression: STRING_EXPR,
    readonly: false,
  },
  argTypes: {
    questionnaire: { table: { disable: true } },
    initialExpression: {
      control: "text",
      description:
        "Pill expression (FHIRPath head, optionally followed by `|| filter` chain).",
    },
    readonly: {
      control: "boolean",
      description:
        "When true, no setter is wired so the panel renders in read-only mode.",
    },
  },
};

export default meta;

type Story = StoryObj<typeof FormattingPanelHarness>;

// --- Empty / value-shape variants ----------------------------------------

export const StringEmpty: Story = {
  name: "String — no filters",
  args: { questionnaire: Q_EDITOR, initialExpression: STRING_EXPR },
};

export const DateEmpty: Story = {
  name: "Date — no filters",
  args: { questionnaire: Q_EDITOR, initialExpression: DATE_EXPR },
};

export const IntegerEmpty: Story = {
  name: "Integer — no filters",
  args: { questionnaire: Q_PATHOLOGY, initialExpression: INTEGER_EXPR },
};

export const DecimalEmpty: Story = {
  name: "Decimal — no filters",
  args: { questionnaire: Q_PATHOLOGY, initialExpression: DECIMAL_EXPR },
};

export const CodingEmpty: Story = {
  name: "Coding — no filters",
  args: { questionnaire: Q_CHOICE, initialExpression: CODING_EXPR },
};

export const UnknownShape: Story = {
  name: "Unknown shape",
  args: { questionnaire: Q_EDITOR, initialExpression: UNKNOWN_EXPR },
};

// --- With existing filters ----------------------------------------------

export const StringWithFilters: Story = {
  name: "String — upcase + default",
  args: {
    questionnaire: Q_EDITOR,
    initialExpression: `${STRING_EXPR} || upcase || default: '/'`,
  },
};

export const StringWithPrefix: Story = {
  name: "String — prefix",
  args: {
    questionnaire: Q_EDITOR,
    initialExpression: `${STRING_EXPR} || prepend: '≈ '`,
  },
};

export const NumericWithDefault: Story = {
  name: "Integer — default fallback",
  args: {
    questionnaire: Q_PATHOLOGY,
    initialExpression: `${INTEGER_EXPR} || default: '—'`,
  },
};

export const DecimalWithUnit: Story = {
  name: "Decimal — unit suffix",
  args: {
    questionnaire: Q_PATHOLOGY,
    initialExpression: `${DECIMAL_EXPR} || append: ' cm'`,
  },
};

export const CodingWithHiddenDesignation: Story = {
  name: "Coding — designation filter is hidden",
  parameters: {
    docs: {
      description: {
        story:
          "The `designation` filter is owned by the SynonymsPanel and never shown here, even when present in the source expression.",
      },
    },
  },
  args: {
    questionnaire: Q_CHOICE,
    initialExpression: `${CODING_EXPR} || designation: 'fully-specified' || default: '—'`,
  },
};

export const UnknownFilterPreserved: Story = {
  name: "Unknown filter — kept as-is",
  parameters: {
    docs: {
      description: {
        story:
          "Filters not in the catalog (e.g. a future `dateformat`) render with a warning rather than being dropped.",
      },
    },
  },
  args: {
    questionnaire: Q_EDITOR,
    initialExpression: `${DATE_EXPR} || dateformat: 'YYYY-MM-DD'`,
  },
};

// --- Read-only -----------------------------------------------------------

export const ReadOnly: Story = {
  name: "Read-only",
  args: {
    questionnaire: Q_EDITOR,
    initialExpression: `${STRING_EXPR} || upcase || default: '/'`,
    readonly: true,
  },
};
