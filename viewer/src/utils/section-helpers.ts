import { analyze_expression, type QuestionnaireIndex } from "fhirpath-rs";
import type { CompositionSection } from "../types";

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
 * Infer context type from a FHIRPath expression using heuristics.
 * Fallback when WASM analyzer is not available.
 */
export function inferContextType(expr: string | null): ContextType {
  if (!expr || expr.trim() === "") {
    return "always";
  }

  // If it has .where(), it's filtering/conditional
  if (/\.where\(/.test(expr)) {
    return "conditional";
  }

  // If it references a repeating item without filtering, it's repeating
  if (/^%(?:context|resource)/.test(expr)) {
    return "repeating";
  }

  return "conditional";
}

/**
 * Analyze context type using the WASM FHIRPath analyzer.
 * Returns the inferred context type based on expression cardinality:
 * - No expression → "always"
 * - Singleton result → "conditional"
 * - Collection result → "repeating"
 */
export function analyzeContextType(
  expr: string | null,
  wasmIndex: QuestionnaireIndex | null
): ContextType {
  if (!expr || expr.trim() === "") {
    return "always";
  }

  if (!wasmIndex) {
    return inferContextType(expr);
  }

  try {
    // Check if expression returns a collection by expecting singleton
    const result = analyze_expression(expr, wasmIndex, undefined, undefined, undefined, "singleton");

    const hasCardinalityMismatch = result.diagnostics?.some(
      (d: { code: string }) => d.code === "expression_cardinality_mismatch"
    );

    // If expecting singleton causes mismatch, it's a collection → repeating
    // Otherwise it's singleton → conditional
    return hasCardinalityMismatch ? "repeating" : "conditional";
  } catch {
    // Fallback to heuristic on error
    return inferContextType(expr);
  }
}

export const CONTEXT_COLORS: Record<ContextType, string> = {
  always: "#6b9fd4",
  conditional: "#9b8cc9",
  repeating: "#5fb090",
  custom: "#d4a85a",
};

export const CONTEXT_ICONS: Record<ContextType, string> = {
  always: "—",
  conditional: "⎇",
  repeating: "↻",
  custom: "{}",
};

export const CONTEXT_LABELS: Record<ContextType, string> = {
  always: "Always",
  conditional: "If exists",
  repeating: "For each",
  custom: "Custom",
};
