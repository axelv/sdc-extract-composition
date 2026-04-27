import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../types";
import {
  clearDesignation,
  findDesignationValue,
  findSupplements,
  listDesignations,
  setDesignation,
} from "./supplement-editor";

const SCT = "http://snomed.info/sct";

function emptyQuestionnaire(): Questionnaire {
  return {
    resourceType: "Questionnaire",
    id: "q",
  };
}

describe("setDesignation", () => {
  it("creates a contained supplement on first write", () => {
    const q = emptyQuestionnaire();
    const next = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "Mild concussion",
    });
    const supplements = findSupplements(next, SCT);
    expect(supplements).toHaveLength(1);
    expect(supplements[0].concept?.[0]?.code).toBe("109006");
    expect(supplements[0].concept?.[0]?.designation?.[0]?.value).toBe(
      "Mild concussion",
    );
  });

  it("does not mutate the input", () => {
    const q = emptyQuestionnaire();
    setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "Mild concussion",
    });
    expect((q as unknown as { contained?: unknown[] }).contained).toBeUndefined();
  });

  it("reuses an existing supplement for the same base system", () => {
    let q = emptyQuestionnaire();
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "First",
    });
    q = setDesignation(q, {
      system: SCT,
      code: "271737000",
      useToken: "synonym",
      value: "Anaemia syn",
    });
    const supplements = findSupplements(q, SCT);
    expect(supplements).toHaveLength(1);
    expect(supplements[0].concept).toHaveLength(2);
  });

  it("replaces an existing designation for the same (code, use)", () => {
    let q = emptyQuestionnaire();
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "First",
    });
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "Second",
    });
    const designations = listDesignations(q, SCT, "109006");
    expect(designations).toHaveLength(1);
    expect(designations[0].value).toBe("Second");
  });

  it("keeps separate entries per use", () => {
    let q = emptyQuestionnaire();
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "Mild concussion",
    });
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "fully-specified",
      value: "Concussion (disorder)",
    });
    const designations = listDesignations(q, SCT, "109006");
    expect(designations).toHaveLength(2);
  });

  it("writes the canonical use Coding for known tokens", () => {
    const q = setDesignation(emptyQuestionnaire(), {
      system: SCT,
      code: "109006",
      useToken: "fully-specified",
      value: "Concussion (disorder)",
    });
    const designations = listDesignations(q, SCT, "109006");
    expect(designations[0].use).toEqual({
      system: SCT,
      code: "900000000000003001",
      display: "Fully specified name",
    });
  });
});

describe("findDesignationValue", () => {
  it("returns null when no supplement matches", () => {
    expect(findDesignationValue(emptyQuestionnaire(), SCT, "x", "synonym")).toBeNull();
  });

  it("matches by alias-known use code", () => {
    const q = setDesignation(emptyQuestionnaire(), {
      system: SCT,
      code: "109006",
      useToken: "fully-specified",
      value: "Concussion (disorder)",
    });
    expect(findDesignationValue(q, SCT, "109006", "fully-specified")).toBe(
      "Concussion (disorder)",
    );
  });
});

describe("clearDesignation", () => {
  it("removes the matching entry only", () => {
    let q = emptyQuestionnaire();
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "syn",
    });
    q = setDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "fully-specified",
      value: "fsn",
    });
    q = clearDesignation(q, {
      system: SCT,
      code: "109006",
      useToken: "synonym",
    });
    const designations = listDesignations(q, SCT, "109006");
    expect(designations).toHaveLength(1);
    expect(designations[0].value).toBe("fsn");
  });

  it("is a no-op when nothing matches", () => {
    const q = setDesignation(emptyQuestionnaire(), {
      system: SCT,
      code: "109006",
      useToken: "synonym",
      value: "syn",
    });
    const next = clearDesignation(q, {
      system: SCT,
      code: "999",
      useToken: "synonym",
    });
    expect(listDesignations(next, SCT, "109006")).toHaveLength(1);
  });
});
