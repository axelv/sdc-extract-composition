// Read/write CodeSystem supplements inside a Questionnaire.contained array.
//
// All functions are pure: they take a Questionnaire JSON and return a new
// Questionnaire with the requested change applied. Designation entries are
// keyed by (system, code, use_code) — language is captured but ignored when
// matching for now (Phase 1 doesn't expose language pinning).

import type { Questionnaire } from "../types";

export interface DesignationUse {
  /** The token authored in the filter argument, e.g. "fully-specified". */
  token: string;
  /** Optional canonical mapping for the use Coding written into the supplement. */
  coding?: { system: string; code: string; display?: string };
}

export interface DesignationEntry {
  /** Resolved use Coding, when known. */
  use: { system?: string; code?: string; display?: string } | null;
  language?: string;
  value: string;
}

/** Common designation use Codings used by the panel's "Show as" selector. */
export const KNOWN_USES: Record<string, DesignationUse> = {
  display: { token: "display" },
  "fully-specified": {
    token: "fully-specified",
    coding: {
      system: "http://snomed.info/sct",
      code: "900000000000003001",
      display: "Fully specified name",
    },
  },
  preferred: {
    token: "preferred",
    coding: {
      system: "http://snomed.info/sct",
      code: "900000000000548007",
      display: "Preferred",
    },
  },
  synonym: {
    token: "synonym",
    coding: {
      system: "http://snomed.info/sct",
      code: "900000000000013009",
      display: "Synonym",
    },
  },
};

interface CodeSystemSupplement {
  resourceType: "CodeSystem";
  id?: string;
  url?: string;
  status?: string;
  content: "supplement";
  supplements: string;
  concept?: ConceptEntry[];
  [key: string]: unknown;
}

interface ConceptEntry {
  code: string;
  designation?: DesignationRecord[];
}

interface DesignationRecord {
  language?: string;
  use?: { system?: string; code?: string; display?: string };
  value: string;
}

const SUPPLEMENT_ID_PREFIX = "synonym-supplement-";

/** Find every contained supplement that targets `system`. */
export function findSupplements(
  questionnaire: Questionnaire,
  system: string,
): CodeSystemSupplement[] {
  const contained = (questionnaire as unknown as { contained?: unknown[] })
    .contained;
  if (!Array.isArray(contained)) return [];
  return contained.filter(
    (r): r is CodeSystemSupplement =>
      isObject(r) &&
      r.resourceType === "CodeSystem" &&
      r.content === "supplement" &&
      r.supplements === system,
  );
}

/** Return all designations recorded for a given (system, code), across all
 *  supplements in the questionnaire. */
export function listDesignations(
  questionnaire: Questionnaire,
  system: string,
  code: string,
): DesignationEntry[] {
  const out: DesignationEntry[] = [];
  for (const supp of findSupplements(questionnaire, system)) {
    const concept = (supp.concept ?? []).find((c) => c.code === code);
    if (!concept || !concept.designation) continue;
    for (const des of concept.designation) {
      out.push({
        use: des.use ?? null,
        language: des.language,
        value: des.value,
      });
    }
  }
  return out;
}

/** Find the designation value that the renderer would resolve for a given use. */
export function findDesignationValue(
  questionnaire: Questionnaire,
  system: string,
  code: string,
  useToken: string,
): string | null {
  const known = KNOWN_USES[useToken];
  for (const entry of listDesignations(questionnaire, system, code)) {
    if (matchesUse(entry.use, useToken, known)) return entry.value;
  }
  return null;
}

/**
 * Add or replace a designation entry. Creates a contained supplement for
 * `system` if one does not yet exist. Returns a new Questionnaire.
 */
export function setDesignation(
  questionnaire: Questionnaire,
  args: {
    system: string;
    code: string;
    useToken: string;
    value: string;
    language?: string;
  },
): Questionnaire {
  const { system, code, useToken, value, language } = args;
  const known = KNOWN_USES[useToken];
  const newDesignation: DesignationRecord = {
    value,
    ...(language ? { language } : {}),
    ...(known?.coding ? { use: known.coding } : { use: { code: useToken } }),
  };

  return updateQuestionnaire(questionnaire, (contained) => {
    const supp = findOrCreateSupplement(contained, system);
    const concept = findOrCreateConcept(supp, code);
    const designations = concept.designation ?? [];
    const existingIdx = designations.findIndex((d) =>
      matchesUse(d.use ?? null, useToken, known),
    );
    if (existingIdx === -1) {
      designations.push(newDesignation);
    } else {
      designations[existingIdx] = newDesignation;
    }
    concept.designation = designations;
  });
}

/** Remove a designation matching (code, useToken). No-op when absent. */
export function clearDesignation(
  questionnaire: Questionnaire,
  args: { system: string; code: string; useToken: string },
): Questionnaire {
  const { system, code, useToken } = args;
  const known = KNOWN_USES[useToken];
  return updateQuestionnaire(questionnaire, (contained) => {
    for (const supp of contained.filter(
      (r): r is CodeSystemSupplement =>
        isObject(r) &&
        r.resourceType === "CodeSystem" &&
        r.content === "supplement" &&
        r.supplements === system,
    )) {
      const concept = (supp.concept ?? []).find((c) => c.code === code);
      if (!concept || !concept.designation) continue;
      concept.designation = concept.designation.filter(
        (d) => !matchesUse(d.use ?? null, useToken, known),
      );
    }
  });
}

// --- internals -------------------------------------------------------------

function updateQuestionnaire(
  questionnaire: Questionnaire,
  mutate: (contained: unknown[]) => void,
): Questionnaire {
  const next = structuredClone(questionnaire) as unknown as {
    contained?: unknown[];
  };
  const contained = (next.contained ??= []);
  mutate(contained);
  return next as unknown as Questionnaire;
}

function findOrCreateSupplement(
  contained: unknown[],
  system: string,
): CodeSystemSupplement {
  for (const r of contained) {
    if (
      isObject(r) &&
      r.resourceType === "CodeSystem" &&
      r.content === "supplement" &&
      r.supplements === system
    ) {
      return r as unknown as CodeSystemSupplement;
    }
  }
  const supp: CodeSystemSupplement = {
    resourceType: "CodeSystem",
    id: `${SUPPLEMENT_ID_PREFIX}${slugifySystem(system)}`,
    url: `urn:uuid:${randomId()}`,
    status: "active",
    content: "supplement",
    supplements: system,
    concept: [],
  };
  contained.push(supp);
  return supp;
}

function findOrCreateConcept(
  supp: CodeSystemSupplement,
  code: string,
): ConceptEntry {
  const list = (supp.concept ??= []);
  let concept = list.find((c) => c.code === code);
  if (!concept) {
    concept = { code };
    list.push(concept);
  }
  return concept;
}

function matchesUse(
  use: { system?: string; code?: string } | null,
  useToken: string,
  known: DesignationUse | undefined,
): boolean {
  if (!use) return useToken === "display";
  if (known?.coding) {
    return use.system === known.coding.system && use.code === known.coding.code;
  }
  return use.code === useToken;
}

function slugifySystem(system: string): string {
  return system
    .replace(/^https?:\/\//, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
