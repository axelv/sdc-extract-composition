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
 * Infer context type from a FHIRPath expression.
 *
 * This is a mock implementation using simple heuristics:
 * - No expression → "always"
 * - Has .where(...) → "conditional" (filtering, boolean result)
 * - Expression without .where() → "repeating" (iterating over list)
 * - Fallback → "custom"
 *
 * Will be replaced by colleague's FHIRPath analyzer that does proper type analysis.
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
  // This is a rough heuristic - assume any expression is repeating unless it filters
  if (/^%(?:context|resource)/.test(expr)) {
    return "repeating";
  }

  // Fallback to custom for complex expressions
  return "custom";
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
