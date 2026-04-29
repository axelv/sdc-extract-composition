import { analyze_expression, type QuestionnaireIndex } from "fhirpath-rs";
import type { CompositionSection } from "../types";
import { parseContextExpression } from "./context-expression";

export const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

export function getContextExpression(section: CompositionSection): string | null {
  const ext = section.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
  );
  return ext?.valueString ?? null;
}

export function isRepeatingContext(expr: string | null): boolean {
  if (!expr) return false;
  if (/^%(?:context|resource)\.where\(/.test(expr)) return false;
  return true;
}

export type ContextType = "always" | "conditional" | "repeating" | "custom";

/**
 * Infer context type from a FHIRPath expression using the parser.
 */
export function inferContextType(expr: string | null): ContextType {
  if (!expr || expr.trim() === "") {
    return "always";
  }

  const config = parseContextExpression(expr);

  switch (config.mode) {
    case "always":
      return "always";
    case "if":
      return "conditional";
    case "for-each":
      return "repeating";
    case "custom":
      return "custom";
  }
}

/**
 * Analyze context type using the parser first, then WASM for custom expressions.
 * - Recognized patterns (always, if, for-each) → use parser result
 * - Custom expressions → use WASM cardinality analysis
 */
export function analyzeContextType(
  expr: string | null,
  wasmIndex: QuestionnaireIndex | null
): ContextType {
  if (!expr || expr.trim() === "") {
    return "always";
  }

  // First try the parser - it knows our canonical patterns
  const config = parseContextExpression(expr);

  // If parser recognized a specific mode, use it
  if (config.mode !== "custom") {
    switch (config.mode) {
      case "always":
        return "always";
      case "if":
        return "conditional";
      case "for-each":
        return "repeating";
    }
  }

  // For custom expressions, use WASM to analyze cardinality
  if (!wasmIndex) {
    return "custom";
  }

  try {
    const result = analyze_expression(expr, wasmIndex, undefined, undefined, undefined, "singleton");

    const hasCardinalityMismatch = result.diagnostics?.some(
      (d: { code: string }) => d.code === "expression_cardinality_mismatch"
    );

    // If expecting singleton causes mismatch, it's a collection → repeating
    // Otherwise it's singleton → conditional
    return hasCardinalityMismatch ? "repeating" : "conditional";
  } catch {
    return "custom";
  }
}

export const CONTEXT_COLORS: Record<string, string> = {
  always: "#6b9fd4",
  conditional: "#9b8cc9",
  repeating: "#5fb090",
  custom: "#d4a85a",
  // Aliases for new mode names
  "if": "#9b8cc9",
  "for-each": "#5fb090",
};

export const CONTEXT_ICONS: Record<ContextType, string> = {
  always: "—",
  conditional: "⎇",
  repeating: "↻",
  custom: "{}",
};

export const CONTEXT_LABELS: Record<ContextType, string> = {
  always: "Always",
  conditional: "Conditional",
  repeating: "For each",
  custom: "Custom",
};
