import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { segmentExpressionToHtml } from "../utils/expression-pills";
import { stripDivWrapper } from "../utils/parse-narrative";
import { ContextBadge } from "./ContextBadge";
import { injectPills, NarrativeHtml } from "./NarrativeHtml";

interface SectionViewProps {
  section: CompositionSection;
  depth?: number;
  questionnaireIndex?: QuestionnaireIndex;
}

const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

const SECTIONS_PLACEHOLDER = "<!-- sections -->";

function getContextExpression(section: CompositionSection): string | null {
  const ext = section.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
  );
  return ext?.valueString ?? null;
}

function hasSectionsPlaceholder(section: CompositionSection): boolean {
  return section.text?.div?.includes(SECTIONS_PLACEHOLDER) ?? false;
}

function isRepeatingContext(expr: string | null): boolean {
  if (!expr) return false;
  if (/^%(?:context|resource)\.where\(/.test(expr)) return false;
  return true;
}

function isCondBlock(section: CompositionSection): boolean {
  return !section.title && !!getContextExpression(section);
}

/**
 * Build the condition indicator HTML for inline cond-blocks.
 * Shows a small icon + label, with expression hidden in a <details>.
 */
function buildCondIndicatorHtml(
  section: CompositionSection,
  questionnaireIndex?: QuestionnaireIndex
): string {
  const ctx = getContextExpression(section);
  if (!ctx) return "";
  const repeating = isRepeatingContext(ctx);
  const icon = repeating ? "↻" : "⎇";
  const label = repeating ? "per item" : "als";
  const exprHtml = segmentExpressionToHtml(ctx, questionnaireIndex);
  return (
    `<details class="cond-details">` +
    `<summary class="cond-summary"><span class="cond-icon">${icon}</span><span class="cond-label">${label}</span></summary>` +
    `<span class="context-badge-resolved" title="${ctx.replace(/"/g, "&quot;")}">${exprHtml}</span>` +
    `</details>`
  );
}

/**
 * Build the full HTML for a section, inlining child section content
 * at the <!-- sections --> placeholder so <tr> stays inside <table>.
 */
function buildSectionHtml(
  section: CompositionSection,
  questionnaireIndex?: QuestionnaireIndex
): string {
  const div = section.text?.div;
  if (!div) return "";

  const linkIdTextMap = questionnaireIndex?.linkIdTextMap;
  let html = stripDivWrapper(div);
  html = injectPills(html, linkIdTextMap);

  if (hasSectionsPlaceholder(section) && section.section?.length) {
    const childrenHtml = section.section
      .map((child) => {
        const childDiv = child.text?.div;
        if (!childDiv) return "";
        const isCond = isCondBlock(child);
        const indicator = buildCondIndicatorHtml(child, questionnaireIndex);
        const childInner = injectPills(
          stripDivWrapper(childDiv),
          linkIdTextMap
        );
        if (isCond) {
          return `<div class="cond-block">${indicator}${childInner}</div>`;
        }
        return childInner;
      })
      .join("\n");

    html = html.replace(SECTIONS_PLACEHOLDER, childrenHtml);
  }

  return html;
}

export function SectionView({
  section,
  depth = 0,
  questionnaireIndex,
}: SectionViewProps) {
  const contextExpr = getContextExpression(section);
  const isCond = isCondBlock(section);
  const repeating = isCond && isRepeatingContext(contextExpr);
  const conditional = isCond && !repeating;
  const inlinesChildren = hasSectionsPlaceholder(section);

  return (
    <div
      className={isCond ? "cond-block" : "py-2"}
      style={{
        marginLeft: depth > 0 && !isCond ? "1rem" : 0,
        ...(!isCond && depth > 0
          ? { borderLeft: "1px solid #e8e5df", paddingLeft: "0.8rem" }
          : {}),
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {section.title && (
          <h3 className="text-sm font-semibold text-gray-900 m-0">
            {section.title}
            {contextExpr && (
              <span className="context-scope-icon" title={contextExpr}>⚙</span>
            )}
          </h3>
        )}
        {isCond && contextExpr && (
          <details className="cond-details">
            <summary className="cond-summary">
              <span className="cond-icon">{repeating ? "↻" : "⎇"}</span>
              <span className="cond-label">{conditional ? "als" : "per item"}</span>
            </summary>
            <ContextBadge expression={contextExpr} questionnaireIndex={questionnaireIndex} />
          </details>
        )}
      </div>

      {inlinesChildren ? (
        <div
          className="narrative-content"
          dangerouslySetInnerHTML={{
            __html: buildSectionHtml(section, questionnaireIndex),
          }}
        />
      ) : (
        <>
          {section.text?.div && (
            <NarrativeHtml
              divHtml={section.text.div}
              linkIdTextMap={questionnaireIndex?.linkIdTextMap}
            />
          )}
          {section.section?.map((child, i) => (
            <SectionView
              key={i}
              section={child}
              depth={depth + 1}
              questionnaireIndex={questionnaireIndex}
            />
          ))}
        </>
      )}
    </div>
  );
}
