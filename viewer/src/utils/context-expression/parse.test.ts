import { describe, it, expect } from "vitest";
import { parseContextExpression } from "./parse";

describe("parseContextExpression", () => {
  describe("always mode", () => {
    it("parses empty string as always", () => {
      expect(parseContextExpression("")).toEqual({ mode: "always" });
    });

    it("parses whitespace as always", () => {
      expect(parseContextExpression("   ")).toEqual({ mode: "always" });
    });
  });

  describe("for-each mode", () => {
    it("parses for-each with context scope", () => {
      const expr = "%context.repeat(item).where(linkId='medications')";
      expect(parseContextExpression(expr)).toEqual({
        mode: "for-each",
        linkId: "medications",
        scope: "context",
      });
    });

    it("parses for-each with resource scope", () => {
      const expr = "%resource.repeat(item).where(linkId='medications')";
      expect(parseContextExpression(expr)).toEqual({
        mode: "for-each",
        linkId: "medications",
        scope: "resource",
      });
    });
  });

  describe("if mode - single condition", () => {
    it("parses exists condition with resource scope", () => {
      const expr = "%context.where(%resource.repeat(item).where(linkId='allergie').answer.exists())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [{ linkId: "allergie", operator: "exists", scope: "resource" }],
      });
    });

    it("parses exists condition with context scope", () => {
      const expr = "%context.where(%context.repeat(item).where(linkId='allergie').answer.exists())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [{ linkId: "allergie", operator: "exists", scope: "context" }],
      });
    });

    it("parses not-exists condition", () => {
      const expr = "%context.where(%resource.repeat(item).where(linkId='allergie').answer.exists().not())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [{ linkId: "allergie", operator: "not-exists", scope: "resource" }],
      });
    });

    it("parses equals condition", () => {
      const expr = "%context.where(%resource.repeat(item).where(linkId='type').answer.value ~ %factory.Coding('http://snomed', '123'))";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [
          {
            linkId: "type",
            operator: "equals",
            scope: "resource",
            value: { system: "http://snomed", code: "123" },
          },
        ],
      });
    });

    it("parses not-equals condition", () => {
      const expr = "%context.where((%resource.repeat(item).where(linkId='type').answer.value ~ %factory.Coding('http://snomed', '123')).not())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [
          {
            linkId: "type",
            operator: "not-equals",
            scope: "resource",
            value: { system: "http://snomed", code: "123" },
          },
        ],
      });
    });
  });

  describe("if mode - multiple conditions", () => {
    it("parses AND conditions", () => {
      const expr = "%context.where(%resource.repeat(item).where(linkId='a').answer.exists() and %resource.repeat(item).where(linkId='b').answer.exists())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [
          { linkId: "a", operator: "exists", scope: "resource" },
          { linkId: "b", operator: "exists", scope: "resource" },
        ],
      });
    });

    it("parses OR conditions", () => {
      const expr = "%context.where(%resource.repeat(item).where(linkId='a').answer.exists() or %resource.repeat(item).where(linkId='b').answer.exists())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "or",
        conditions: [
          { linkId: "a", operator: "exists", scope: "resource" },
          { linkId: "b", operator: "exists", scope: "resource" },
        ],
      });
    });

    it("parses mixed scopes", () => {
      const expr = "%context.where(%context.repeat(item).where(linkId='a').answer.exists() and %resource.repeat(item).where(linkId='b').answer.exists())";
      expect(parseContextExpression(expr)).toEqual({
        mode: "if",
        combineMode: "and",
        conditions: [
          { linkId: "a", operator: "exists", scope: "context" },
          { linkId: "b", operator: "exists", scope: "resource" },
        ],
      });
    });
  });

  describe("custom mode fallback", () => {
    it("falls back for unrecognized patterns", () => {
      const expr = "%resource.item.something.else";
      expect(parseContextExpression(expr)).toEqual({
        mode: "custom",
        expression: expr,
      });
    });

    it("falls back for complex nested expressions", () => {
      const expr = "%context.where((a and b) or c)";
      expect(parseContextExpression(expr)).toEqual({
        mode: "custom",
        expression: expr,
      });
    });
  });
});
