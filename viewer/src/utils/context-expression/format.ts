/**
 * Formatter: ContextConfig → FHIRPath expression
 */

import type { Condition, ContextConfig } from "./types";

function formatCondition(cond: Condition): string {
  const prefix = cond.scope === "context" ? "%context" : "%resource";
  const base = `${prefix}.repeat(item).where(linkId='${cond.linkId}').answer`;

  switch (cond.operator) {
    case "exists":
      return `${base}.exists()`;

    case "not-exists":
      return `${base}.exists().not()`;

    case "equals":
      if (!cond.value) return `${base}.exists()`;
      return `${base}.value ~ %factory.Coding('${cond.value.system}', '${cond.value.code}')`;

    case "not-equals":
      if (!cond.value) return `${base}.exists().not()`;
      return `(${base}.value ~ %factory.Coding('${cond.value.system}', '${cond.value.code}')).not()`;
  }
}

export function formatContextExpression(config: ContextConfig): string {
  switch (config.mode) {
    case "always":
      return "";

    case "for-each": {
      const prefix = config.scope === "resource" ? "%resource" : "%context";
      return `${prefix}.repeat(item).where(linkId='${config.linkId}')`;
    }

    case "if": {
      if (config.conditions.length === 0) {
        return "";
      }
      const parts = config.conditions.map(formatCondition);
      const joined = parts.join(` ${config.combineMode} `);
      return `%context.where(${joined})`;
    }

    case "custom":
      return config.expression;
  }
}
