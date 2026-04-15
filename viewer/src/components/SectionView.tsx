import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { segmentExpressionToHtml } from "../utils/expression-pills";
import { stripDivWrapper } from "../utils/parse-narrative";
import { ContextBadge } from "./ContextBadge";
import { ContextTooltip } from "./ContextTooltip";
import { injectPills, NarrativeHtml } from "./NarrativeHtml";

interface SectionViewProps {
  section: CompositionSection;
  depth?: number;
  questionnaireIndex?: QuestionnaireIndex;
  showContext?: boolean;
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
 * Shows a badge chip with a CSS hover tooltip revealing the expression.
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
  const summaryClass = repeating ? "cond-repeating" : "cond-conditional";
  const exprHtml = segmentExpressionToHtml(ctx, questionnaireIndex);
  return (
    `<div class="cond-badge-margin">` +
    `<span class="cond-summary ${summaryClass}" title="${ctx.replace(/"/g, "&quot;")}">` +
    `<span class="cond-icon">${icon}</span><span class="cond-label">${label}</span>` +
    `</span>` +
    `<div class="cond-hover-tooltip">` +
    `<span class="context-badge-resolved">${exprHtml}</span>` +
    `</div>` +
    `</div>`
  );
}

/**
 * Build the full HTML for a section, inlining child section content
 * at the <!-- sections --> placeholder so <tr> stays inside <table>.
 */
function buildSectionHtml(
  section: CompositionSection,
  questionnaireIndex?: QuestionnaireIndex,
  showContext = true
): string {
  const div = section.text?.div;
  if (!div) return "";

  let html = stripDivWrapper(div);
  html = injectPills(html, questionnaireIndex);

  if (hasSectionsPlaceholder(section) && section.section?.length) {
    const childrenHtml = section.section
      .map((child) => {
        const childDiv = child.text?.div;
        if (!childDiv) return "";
        const isCond = isCondBlock(child);
        const indicator = showContext ? buildCondIndicatorHtml(child, questionnaireIndex) : "";
        const childInner = injectPills(
          stripDivWrapper(childDiv),
          questionnaireIndex
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
  showContext = true,
}: SectionViewProps) {
  const contextExpr = getContextExpression(section);
  const repeating = isRepeatingContext(contextExpr);
  const inlinesChildren = hasSectionsPlaceholder(section);

  return (
    <div className="section-block" data-depth={depth} style={{ '--depth-offset': `${depth * 0.7}rem` } as React.CSSProperties}>
      {showContext && contextExpr && (
        <div className="cond-badge-margin">
          <ContextTooltip
            content={<ContextBadge expression={contextExpr} questionnaireIndex={questionnaireIndex} />}
          >
            <span className={`cond-summary ${repeating ? 'cond-repeating' : 'cond-conditional'}`}>
              <span className="cond-icon">{repeating ? "↻" : "⎇"}</span>
              <span className="cond-label">{repeating ? "per item" : "als"}</span>
            </span>
          </ContextTooltip>
        </div>
      )}
      {section.title && (
        <h3 className="text-sm font-semibold text-gray-900 m-0">
          {section.title}
        </h3>
      )}

      {inlinesChildren ? (
        <div
          className="narrative-content"
          dangerouslySetInnerHTML={{
            __html: buildSectionHtml(section, questionnaireIndex, showContext),
          }}
        />
      ) : (
        <>
          {section.text?.div && (
            <NarrativeHtml
              divHtml={section.text.div}
              questionnaireIndex={questionnaireIndex}
            />
          )}
          {section.section?.map((child, i) => (
            <SectionView
              key={i}
              section={child}
              depth={depth + 1}
              questionnaireIndex={questionnaireIndex}
              showContext={showContext}
            />
          ))}
        </>
      )}
    </div>
  );
}
