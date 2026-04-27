import type { Questionnaire } from "../types";

interface QuestionnaireItem {
  linkId: string;
  text?: string;
  type?: string;
  answerOption?: { valueCoding?: { system?: string; code: string; display?: string } }[];
  item?: QuestionnaireItem[];
}

export interface AnswerOption {
  system?: string;
  code: string;
  display?: string;
}

export interface QuestionnaireItemInfo {
  linkId: string;
  text: string;
  type: string;
  /** Full FHIRPath to reach this item (e.g. %resource.item.where(linkId='parent').item.where(linkId='child')) */
  path: string;
  /** code → display from answerOption[].valueCoding */
  answerOptions: Map<string, string>;
  /** code → full Coding (preserves system, display) for supplement edits */
  answerCodings: Map<string, AnswerOption>;
}

export interface QuestionnaireIndex {
  items: Map<string, QuestionnaireItemInfo>;
  /** Backward-compatible linkId → text map */
  linkIdTextMap: Map<string, string>;
  resolveItemText(linkId: string): string | null;
  resolveCodeDisplay(linkId: string, code: string): string | null;
  resolveAnswerCoding(linkId: string, code: string): AnswerOption | null;
  listAnswerCodings(linkId: string): AnswerOption[];
  resolveItemType(linkId: string): string | null;
}

/**
 * Build a flat map of linkId → item text from all Questionnaire items.
 * @deprecated Use buildQuestionnaireIndex instead.
 */
export function buildLinkIdTextMap(
  questionnaire: Questionnaire
): Map<string, string> {
  return buildQuestionnaireIndex(questionnaire).linkIdTextMap;
}

/**
 * Build a rich index of all Questionnaire items with text, type, and answer options.
 */
export function buildQuestionnaireIndex(
  questionnaire: Questionnaire
): QuestionnaireIndex {
  const items = new Map<string, QuestionnaireItemInfo>();
  const linkIdTextMap = new Map<string, string>();

  function walk(qItems: QuestionnaireItem[], parentPath: string = "%resource") {
    for (const item of qItems) {
      const answerOptions = new Map<string, string>();
      const answerCodings = new Map<string, AnswerOption>();
      if (item.answerOption) {
        for (const opt of item.answerOption) {
          const c = opt.valueCoding;
          if (!c?.code) continue;
          if (c.display) {
            answerOptions.set(c.code, c.display);
          }
          answerCodings.set(c.code, {
            system: c.system,
            code: c.code,
            display: c.display,
          });
        }
      }

      const text = item.text ?? item.linkId;
      const path = `${parentPath}.item.where(linkId='${item.linkId}')`;
      items.set(item.linkId, {
        linkId: item.linkId,
        text,
        type: item.type ?? "group",
        path,
        answerOptions,
        answerCodings,
      });

      if (item.text) {
        linkIdTextMap.set(item.linkId, item.text);
      }

      if (item.item) {
        walk(item.item, path);
      }
    }
  }

  const rootItems = (questionnaire as unknown as Record<string, unknown>).item;
  if (Array.isArray(rootItems)) {
    walk(rootItems as QuestionnaireItem[]);
  }

  return {
    items,
    linkIdTextMap,
    resolveItemText(linkId: string): string | null {
      return items.get(linkId)?.text ?? null;
    },
    resolveCodeDisplay(linkId: string, code: string): string | null {
      return items.get(linkId)?.answerOptions.get(code) ?? null;
    },
    resolveAnswerCoding(linkId: string, code: string): AnswerOption | null {
      return items.get(linkId)?.answerCodings.get(code) ?? null;
    },
    listAnswerCodings(linkId: string): AnswerOption[] {
      const info = items.get(linkId);
      if (!info) return [];
      return Array.from(info.answerCodings.values());
    },
    resolveItemType(linkId: string): string | null {
      return items.get(linkId)?.type ?? null;
    },
  };
}
