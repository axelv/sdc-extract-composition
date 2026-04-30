export interface Extension {
  url: string;
  valueString?: string;
  valueReference?: { reference: string };
  extension?: Extension[];
}

export interface Narrative {
  status: string;
  div: string;
}

export type AnimationState = "adding" | "updating" | "deleting";

export interface CompositionSection {
  title?: string;
  code?: {
    coding: { system: string; code: string; display: string }[];
  };
  text?: Narrative;
  extension?: Extension[];
  section?: CompositionSection[];
  _id?: string;
  _animationState?: AnimationState;
}

export interface Composition {
  resourceType: "Composition";
  id: string;
  status: string;
  type?: {
    coding: { system: string; code: string; display: string }[];
  };
  title?: string;
  date?: string;
  _date?: { extension?: Extension[] };
  section?: CompositionSection[];
}

export interface Questionnaire {
  resourceType: "Questionnaire";
  id?: string;
  title?: string;
  contained?: (Composition | Record<string, unknown>)[];
}
