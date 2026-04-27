import { createContext, useContext } from "react";
import type { Questionnaire } from "../../types";

export interface QuestionnaireBinding {
  questionnaire: Questionnaire;
  /** Omit to mark the binding read-only. Consumers gate edit affordances on
   *  this being defined; reads always work. */
  setQuestionnaire?: (next: Questionnaire) => void;
}

const QuestionnaireContext = createContext<QuestionnaireBinding | undefined>(
  undefined,
);

export const QuestionnaireProvider = QuestionnaireContext.Provider;

export function useQuestionnaire(): QuestionnaireBinding | undefined {
  return useContext(QuestionnaireContext);
}
