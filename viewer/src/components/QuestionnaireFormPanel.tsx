import type { Questionnaire } from "../types";
import { TiroFormFiller } from "./TiroFormFiller";

interface QuestionnaireFormPanelProps {
  questionnaire: Questionnaire;
  onResponse: (qr: Record<string, unknown>) => void;
}

export function QuestionnaireFormPanel({
  questionnaire,
  onResponse,
}: QuestionnaireFormPanelProps) {
  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Questionnaire</h2>
      </div>
      <div className="panel-body">
        <TiroFormFiller
          questionnaire={questionnaire}
          onResponse={onResponse}
        />
      </div>
    </div>
  );
}
