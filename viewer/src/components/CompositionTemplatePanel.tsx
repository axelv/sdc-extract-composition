import { useState } from "react";
import type { Composition } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { CompositionView } from "./CompositionView";
import { RawCompositionView } from "./RawCompositionView";

type Tab = "template" | "structure";

interface CompositionTemplatePanelProps {
  composition: Composition;
  questionnaireIndex?: QuestionnaireIndex;
  showContext: boolean;
}

export function CompositionTemplatePanel({
  composition,
  questionnaireIndex,
  showContext,
}: CompositionTemplatePanelProps) {
  const [tab, setTab] = useState<Tab>("template");

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Template</h2>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          {(["template", "structure"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                tab === t
                  ? "bg-white shadow-sm text-gray-900 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "template" ? "Template" : "Structure"}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        {tab === "template" ? (
          <CompositionView
            composition={composition}
            questionnaireIndex={questionnaireIndex}
            showContext={showContext}
          />
        ) : (
          <RawCompositionView composition={composition} />
        )}
      </div>
    </div>
  );
}
