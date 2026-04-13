import { useCallback, useRef } from "react";
import type { Questionnaire } from "../types";
import { TiroFormFiller } from "./TiroFormFiller";

interface QuestionnaireFormPanelProps {
  questionnaire: Questionnaire;
  onResponse: (qr: Record<string, unknown>) => void;
  hasResponse: boolean;
}

export function QuestionnaireFormPanel({
  questionnaire,
  onResponse,
  hasResponse,
}: QuestionnaireFormPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.resourceType !== "QuestionnaireResponse") {
            return;
          }
          onResponse(parsed);
        } catch {
          // ignore invalid JSON
        }
      };
      reader.readAsText(file);
    },
    [onResponse]
  );

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Questionnaire</h2>
        <div className="flex items-center gap-2">
          {hasResponse && (
            <span className="text-xs text-green-600 font-medium">has QR</span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-0.5"
          >
            Load QR
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
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
