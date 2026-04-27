import { describe, expect, it } from "vitest";
import {
  formatExpression,
  getDesignationUse,
  parseExpression,
  setDesignationUse,
} from "./filter-pipeline";

describe("parseExpression", () => {
  it("returns the head when there are no filters", () => {
    const parsed = parseExpression(" %resource.id ");
    expect(parsed.head).toBe("%resource.id");
    expect(parsed.filters).toEqual([]);
  });

  it("parses a single filter without arguments", () => {
    const parsed = parseExpression("name || upcase");
    expect(parsed.head).toBe("name");
    expect(parsed.filters).toHaveLength(1);
    expect(parsed.filters[0].name).toBe("upcase");
    expect(parsed.filters[0].args).toEqual([]);
  });

  it("parses a chained pipeline with arguments", () => {
    const parsed = parseExpression(
      "answer.value || designation: \"fully-specified\" || upcase",
    );
    expect(parsed.filters.map((f) => f.name)).toEqual([
      "designation",
      "upcase",
    ]);
    expect(parsed.filters[0].args).toEqual(["fully-specified"]);
  });

  it("respects double-pipe inside a quoted argument", () => {
    const parsed = parseExpression("name || prepend: 'a || b '");
    expect(parsed.filters).toHaveLength(1);
    expect(parsed.filters[0].args).toEqual(["a || b "]);
  });

  it("does not split FHIRPath single-pipe union operator", () => {
    const parsed = parseExpression("Patient.name | Patient.telecom");
    expect(parsed.head).toBe("Patient.name | Patient.telecom");
    expect(parsed.filters).toEqual([]);
  });
});

describe("getDesignationUse / setDesignationUse", () => {
  it("returns null when no designation filter is present", () => {
    const parsed = parseExpression("name || upcase");
    expect(getDesignationUse(parsed)).toBeNull();
  });

  it("reads the use argument", () => {
    const parsed = parseExpression(
      "answer.value || designation: \"fully-specified\"",
    );
    expect(getDesignationUse(parsed)).toBe("fully-specified");
  });

  it("appends a designation filter when missing", () => {
    const parsed = parseExpression("answer.value");
    const next = setDesignationUse(parsed, "synonym");
    expect(formatExpression(next)).toBe(
      "answer.value || designation: \"synonym\"",
    );
  });

  it("replaces an existing designation filter", () => {
    const parsed = parseExpression(
      "answer.value || designation: \"synonym\" || upcase",
    );
    const next = setDesignationUse(parsed, "fully-specified");
    expect(formatExpression(next)).toBe(
      "answer.value || designation: \"fully-specified\" || upcase",
    );
  });

  it("removes the designation filter when set to null", () => {
    const parsed = parseExpression(
      "answer.value || designation: \"synonym\" || upcase",
    );
    const next = setDesignationUse(parsed, null);
    expect(formatExpression(next)).toBe("answer.value || upcase");
  });

  it("is a no-op when removing a designation that wasn't there", () => {
    const parsed = parseExpression("answer.value || upcase");
    const next = setDesignationUse(parsed, null);
    expect(formatExpression(next)).toBe("answer.value || upcase");
  });
});
