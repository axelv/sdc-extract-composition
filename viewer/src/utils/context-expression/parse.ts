/**
 * Parser: FHIRPath expression → ContextConfig
 *
 * Only handles our canonical patterns. Falls back to "custom" mode
 * for expressions that don't match.
 */

import type { CombineMode, Condition, ContextConfig } from "./types";

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.exists()
const EXISTS_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.exists\(\)$/;

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.exists().not()
const NOT_EXISTS_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.exists\(\)\.not\(\)$/;

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.value ~ %factory.Coding('system', 'code')
const EQUALS_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)$/;

// Pattern: (%(context|resource).repeat(item).where(linkId='X').answer.value ~ %factory.Coding('system', 'code')).not()
const NOT_EQUALS_PATTERN =
  /^\(%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)\)\.not\(\)$/;

// Pattern: %context.repeat(item).where(linkId='X') or %resource.repeat(item).where(linkId='X')
const FOR_EACH_PATTERN = /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)$/;

// Pattern: %context.where(...)
const CONTEXT_WHERE_PATTERN = /^%context\.where\((.+)\)$/s;

function parseCondition(expr: string): Condition | null {
  const trimmed = expr.trim();

  let match = trimmed.match(EXISTS_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "exists",
      scope: match[1] as "context" | "resource",
    };
  }

  match = trimmed.match(NOT_EXISTS_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "not-exists",
      scope: match[1] as "context" | "resource",
    };
  }

  match = trimmed.match(EQUALS_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "equals",
      scope: match[1] as "context" | "resource",
      value: { system: match[3], code: match[4] },
    };
  }

  match = trimmed.match(NOT_EQUALS_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "not-equals",
      scope: match[1] as "context" | "resource",
      value: { system: match[3], code: match[4] },
    };
  }

  return null;
}

/**
 * Split string by separator at top level (respecting parentheses).
 */
function splitTopLevel(str: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let i = 0;

  while (i < str.length) {
    if (str[i] === "(") {
      depth++;
      current += str[i];
      i++;
    } else if (str[i] === ")") {
      depth--;
      current += str[i];
      i++;
    } else if (depth === 0 && str.substring(i).startsWith(sep)) {
      parts.push(current.trim());
      current = "";
      i += sep.length;
    } else {
      current += str[i];
      i++;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Split conditions by 'and' or 'or' at the top level.
 */
function splitConditions(
  inner: string
): { combineMode: CombineMode; parts: string[] } {
  const andParts = splitTopLevel(inner, " and ");
  if (andParts.length > 1) {
    return { combineMode: "and", parts: andParts };
  }

  const orParts = splitTopLevel(inner, " or ");
  if (orParts.length > 1) {
    return { combineMode: "or", parts: orParts };
  }

  return { combineMode: "and", parts: [inner] };
}

export function parseContextExpression(expr: string): ContextConfig {
  const trimmed = expr.trim();

  if (!trimmed) {
    return { mode: "always" };
  }

  const forEachMatch = trimmed.match(FOR_EACH_PATTERN);
  if (forEachMatch) {
    return {
      mode: "for-each",
      linkId: forEachMatch[2],
      scope: forEachMatch[1] as "context" | "resource",
    };
  }

  const whereMatch = trimmed.match(CONTEXT_WHERE_PATTERN);
  if (whereMatch) {
    const inner = whereMatch[1];
    const { combineMode, parts } = splitConditions(inner);

    const conditions: Condition[] = [];
    for (const part of parts) {
      const cond = parseCondition(part);
      if (cond) {
        conditions.push(cond);
      } else {
        return { mode: "custom", expression: trimmed };
      }
    }

    if (conditions.length > 0) {
      return { mode: "if", combineMode, conditions };
    }
  }

  return { mode: "custom", expression: trimmed };
}
