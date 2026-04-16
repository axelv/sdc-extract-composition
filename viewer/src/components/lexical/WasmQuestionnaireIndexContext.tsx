import { createContext, useContext } from "react";
import type { QuestionnaireIndex } from "fhirpath-rs";

const WasmQuestionnaireIndexContext = createContext<QuestionnaireIndex | null>(
  null,
);

export const WasmQuestionnaireIndexProvider =
  WasmQuestionnaireIndexContext.Provider;

export function useWasmQuestionnaireIndex(): QuestionnaireIndex | null {
  return useContext(WasmQuestionnaireIndexContext);
}
