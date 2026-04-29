/**
 * Formatter: ContextConfig → FHIRPath expression
 */

import type { QuestionnaireIndex } from "../questionnaire-index";
import type { Condition, ContextConfig } from "./types";

function formatCondition(
  cond: Condition,
  questionnaireIndex?: QuestionnaireIndex
): string {
  const itemInfo = questionnaireIndex?.items.get(cond.linkId);
  let base: string;

  if (cond.scope === "context") {
    // Context scope: use simple relative path (we're already inside the context)
    base = `%context.item.where(linkId='${cond.linkId}').answer`;
  } else if (itemInfo) {
    // Resource scope: use full path from questionnaire index
    base = itemInfo.path + ".answer";
  } else {
    // Fallback for resource scope if index not available
    base = `%resource.repeat(item).where(linkId='${cond.linkId}').answer`;
  }

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

export function formatContextExpression(
  config: ContextConfig,
  questionnaireIndex?: QuestionnaireIndex
): string {
  switch (config.mode) {
    case "always":
      return "";

    case "for-each": {
      const itemInfo = questionnaireIndex?.items.get(config.linkId);
      if (itemInfo) {
        // Use the actual path from questionnaire index
        if (config.scope === "context") {
          return itemInfo.path.replace("%resource", "%context");
        }
        return itemInfo.path;
      }
      // Fallback to repeat(item) pattern if index not available
      const prefix = config.scope === "resource" ? "%resource" : "%context";
      return `${prefix}.repeat(item).where(linkId='${config.linkId}')`;
    }

    case "if": {
      if (config.conditions.length === 0) {
        return "";
      }
      const parts = config.conditions.map((c) =>
        formatCondition(c, questionnaireIndex)
      );
      const joined = parts.join(` ${config.combineMode} `);
      return `%context.where(${joined})`;
    }

    case "custom":
      return config.expression;
  }
}
