/**
 * Parser: FHIRPath expression → ContextConfig
 *
 * Only handles our canonical patterns. Falls back to "custom" mode
 * for expressions that don't match.
 */

import type { CombineMode, Condition, ContextConfig } from "./types";

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.exists() - old format
const EXISTS_REPEAT_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.exists\(\)$/;

// Pattern: %(context|resource)...item.where(linkId='X').answer.exists() - new format
// Matches both simple %context.item.where(linkId='X') and full paths
const EXISTS_ITEM_PATTERN =
  /^%(context|resource)(?:\.item\.where\(linkId='[^']+'\))*\.item\.where\(linkId='([^']+)'\)\.answer\.exists\(\)$/;

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.exists().not() - old format
const NOT_EXISTS_REPEAT_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.exists\(\)\.not\(\)$/;

// Pattern: %(context|resource)...item.where(linkId='X').answer.exists().not() - new format
const NOT_EXISTS_ITEM_PATTERN =
  /^%(context|resource)(?:\.item\.where\(linkId='[^']+'\))*\.item\.where\(linkId='([^']+)'\)\.answer\.exists\(\)\.not\(\)$/;

// Pattern: %(context|resource).repeat(item).where(linkId='X').answer.value ~ %factory.Coding('system', 'code') - old format
const EQUALS_REPEAT_PATTERN =
  /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)$/;

// Pattern: %(context|resource)...item.where(linkId='X').answer.value ~ %factory.Coding(...) - new format
const EQUALS_ITEM_PATTERN =
  /^%(context|resource)(?:\.item\.where\(linkId='[^']+'\))*\.item\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)$/;

// Pattern: (%(context|resource).repeat(item).where(linkId='X').answer.value ~ %factory.Coding('system', 'code')).not() - old format
const NOT_EQUALS_REPEAT_PATTERN =
  /^\(%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)\)\.not\(\)$/;

// Pattern: (%(context|resource)...item.where(linkId='X').answer.value ~ %factory.Coding(...)).not() - new format
const NOT_EQUALS_ITEM_PATTERN =
  /^\(%(context|resource)(?:\.item\.where\(linkId='[^']+'\))*\.item\.where\(linkId='([^']+)'\)\.answer\.value\s*~\s*%factory\.Coding\('([^']+)',\s*'([^']+)'\)\)\.not\(\)$/;

// Pattern: %context.repeat(item).where(linkId='X') or %resource.repeat(item).where(linkId='X')
const FOR_EACH_REPEAT_PATTERN = /^%(context|resource)\.repeat\(item\)\.where\(linkId='([^']+)'\)$/;

// Pattern: %(context|resource).item.where(linkId='...')...item.where(linkId='X') - new format
// Matches paths like %resource.item.where(linkId='medications').item.where(linkId='medication')
const FOR_EACH_ITEM_PATTERN = /^%(context|resource)(?:\.item\.where\(linkId='[^']+'\))+$/;

// Pattern: %context.where(...)
const CONTEXT_WHERE_PATTERN = /^%context\.where\((.+)\)$/s;

function parseCondition(expr: string): Condition | null {
  const trimmed = expr.trim();

  // Try exists patterns (old and new)
  let match = trimmed.match(EXISTS_REPEAT_PATTERN) ?? trimmed.match(EXISTS_ITEM_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "exists",
      scope: match[1] as "context" | "resource",
    };
  }

  // Try not-exists patterns (old and new)
  match = trimmed.match(NOT_EXISTS_REPEAT_PATTERN) ?? trimmed.match(NOT_EXISTS_ITEM_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "not-exists",
      scope: match[1] as "context" | "resource",
    };
  }

  // Try equals patterns (old and new)
  match = trimmed.match(EQUALS_REPEAT_PATTERN) ?? trimmed.match(EQUALS_ITEM_PATTERN);
  if (match) {
    return {
      linkId: match[2],
      operator: "equals",
      scope: match[1] as "context" | "resource",
      value: { system: match[3], code: match[4] },
    };
  }

  // Try not-equals patterns (old and new)
  match = trimmed.match(NOT_EQUALS_REPEAT_PATTERN) ?? trimmed.match(NOT_EQUALS_ITEM_PATTERN);
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

  // Try old repeat(item) format
  const forEachRepeatMatch = trimmed.match(FOR_EACH_REPEAT_PATTERN);
  if (forEachRepeatMatch) {
    return {
      mode: "for-each",
      linkId: forEachRepeatMatch[2],
      scope: forEachRepeatMatch[1] as "context" | "resource",
    };
  }

  // Try new .item.where() format - extract last linkId from the path
  const forEachItemMatch = trimmed.match(FOR_EACH_ITEM_PATTERN);
  if (forEachItemMatch) {
    // Extract the last linkId from the chain
    const linkIdMatches = trimmed.match(/\.where\(linkId='([^']+)'\)/g);
    if (linkIdMatches && linkIdMatches.length > 0) {
      const lastMatch = linkIdMatches[linkIdMatches.length - 1];
      const linkId = lastMatch.match(/linkId='([^']+)'/)?.[1];
      if (linkId) {
        return {
          mode: "for-each",
          linkId,
          scope: forEachItemMatch[1] as "context" | "resource",
        };
      }
    }
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
