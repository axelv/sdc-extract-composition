import { useState } from "react";
import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { segmentExpressionToHtml } from "../utils/expression-pills";
import { stripDivWrapper } from "../utils/parse-narrative";
import { useWasmReady } from "../utils/wasm-init";
import { ContextBadge } from "./ContextBadge";
import { ContextExpressionModal } from "./ContextExpressionModal";
import { ContextTooltip } from "./ContextTooltip";
import { NarrativeEditorModal } from "./lexical/NarrativeEditorModal";
import { injectPills, NarrativeHtml } from "./NarrativeHtml";

interface SectionViewProps {
  section: CompositionSection;
  depth?: number;
  questionnaireIndex?: QuestionnaireIndex;
  showContext?: boolean;
  sectionPath?: number[];
  onSectionHtmlChange?: (sectionPath: number[], newDivHtml: string) => void;
  onSectionTitleChange?: (sectionPath: number[], newTitle: string) => void;
  onContextExpressionChange?: (sectionPath: number[], newExpression: string) => void;
  onAddSection?: (parentPath: number[]) => void;
  onRemoveSection?: (sectionPath: number[]) => void;
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

/**
 * Whether child sections must be inlined into the parent HTML
 * (e.g. <tr> rows inside a <table>). For non-table parents we can
 * render children as individual SectionView components instead.
 */
function mustInlineChildren(section: CompositionSection): boolean {
  if (!hasSectionsPlaceholder(section)) return false;
  const div = section.text?.div ?? "";
  return /<table\b/i.test(div);
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

/**
 * Renders a section's narrative text and child sections.
 * When the parent text.div contains <!-- sections -->, splits the content
 * around the placeholder and interleaves child SectionView components.
 */
function SectionContentWithChildren({
  section,
  depth,
  questionnaireIndex,
  showContext,
  sectionPath,
  editable,
  onNarrativeClick,
  onSectionHtmlChange,
  onSectionTitleChange,
  onContextExpressionChange,
  onAddSection,
  onRemoveSection,
}: {
  section: CompositionSection;
  depth: number;
  questionnaireIndex?: QuestionnaireIndex;
  showContext: boolean;
  sectionPath: number[];
  editable: boolean;
  onNarrativeClick: () => void;
  onSectionHtmlChange?: (sectionPath: number[], newDivHtml: string) => void;
  onSectionTitleChange?: (sectionPath: number[], newTitle: string) => void;
  onContextExpressionChange?: (sectionPath: number[], newExpression: string) => void;
  onAddSection?: (parentPath: number[]) => void;
  onRemoveSection?: (sectionPath: number[]) => void;
}) {
  const divHtml = section.text?.div;
  const hasPlaceholder = hasSectionsPlaceholder(section);
  const inner = divHtml ? stripDivWrapper(divHtml).trim() : "";
  const isContainerOnly = inner === SECTIONS_PLACEHOLDER;

  const children = section.section?.map((child, i) => (
    <SectionView
      key={i}
      section={child}
      depth={depth + 1}
      questionnaireIndex={questionnaireIndex}

      showContext={showContext}
      sectionPath={[...sectionPath, i]}
      onSectionHtmlChange={onSectionHtmlChange}
      onSectionTitleChange={onSectionTitleChange}
      onContextExpressionChange={onContextExpressionChange}
      onAddSection={onAddSection}
      onRemoveSection={onRemoveSection}
    />
  ));

  const addChildButton = onAddSection && (
    <button
      className="section-add-btn section-add-btn-nested"
      onClick={() => onAddSection(sectionPath)}
      title="Add child section"
    >
      + Add subsection
    </button>
  );

  // No placeholder — simple case
  if (!hasPlaceholder) {
    return (
      <>
        {divHtml && (
          <NarrativeHtml
            divHtml={divHtml}
            questionnaireIndex={questionnaireIndex}
            onClick={editable ? onNarrativeClick : undefined}
          />
        )}
        {children}
        {addChildButton}
      </>
    );
  }

  // Container-only (text.div is just <!-- sections -->) — skip parent text, render children directly
  if (isContainerOnly) {
    return <>{children}{addChildButton}</>;
  }

  // Mixed content: split around <!-- sections --> and interleave
  const [before, after] = inner.split(SECTIONS_PLACEHOLDER);
  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const beforeDiv = before.trim() ? `<div xmlns="${XHTML_NS}">${before}</div>` : null;
  const afterDiv = after.trim() ? `<div xmlns="${XHTML_NS}">${after}</div>` : null;

  return (
    <>
      {beforeDiv && (
        <NarrativeHtml
          divHtml={beforeDiv}
          questionnaireIndex={questionnaireIndex}
          onClick={editable ? onNarrativeClick : undefined}
        />
      )}
      {children}
      {addChildButton}
      {afterDiv && (
        <NarrativeHtml
          divHtml={afterDiv}
          questionnaireIndex={questionnaireIndex}
          onClick={editable ? onNarrativeClick : undefined}
        />
      )}
    </>
  );
}

export function SectionView({
  section,
  depth = 0,
  questionnaireIndex,
  showContext = true,
  sectionPath = [],
  onSectionHtmlChange,
  onSectionTitleChange,
  onContextExpressionChange,
  onAddSection,
  onRemoveSection,
}: SectionViewProps) {
  // Re-render when wasm is ready so the inline pill HTML reflects analyzer
  // output (cond indicators, narrative pill injection, etc.).
  useWasmReady();
  const contextExpr = getContextExpression(section);
  const repeating = isRepeatingContext(contextExpr);
  const inlinesChildren = mustInlineChildren(section);

  const [narrativeModalOpen, setNarrativeModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);

  const editable = !!onSectionHtmlChange;

  return (
    <div className="section-block" data-depth={depth} style={{ '--depth-offset': `calc(${depth * 0.7}rem + ${depth * 2}px)` } as React.CSSProperties}>
      {showContext && contextExpr && (
        <div className="cond-badge-margin">
          <ContextTooltip
            content={<ContextBadge expression={contextExpr} questionnaireIndex={questionnaireIndex} />}
          >
            <span
              className={`cond-summary ${repeating ? 'cond-repeating' : 'cond-conditional'}${editable ? ' cursor-pointer' : ''}`}
              onClick={editable ? (e) => { e.stopPropagation(); setContextModalOpen(true); } : undefined}
            >
              <span className="cond-icon">{repeating ? "↻" : "⎇"}</span>
              <span className="cond-label">{repeating ? "per item" : "als"}</span>
            </span>
          </ContextTooltip>
        </div>
      )}
      {showContext && !contextExpr && editable && (
        <div className="cond-badge-margin">
          <button
            className="cond-summary cond-add-context"
            onClick={(e) => { e.stopPropagation(); setContextModalOpen(true); }}
            title="Add context expression"
          >
            <span className="cond-icon">+</span>
            <span className="cond-label">context</span>
          </button>
        </div>
      )}
      {section.title && (
        <div className="section-header">
          <h3
            className={`text-sm font-semibold text-gray-900 m-0${editable ? " section-title-editable" : ""}`}
            onClick={editable ? () => setNarrativeModalOpen(true) : undefined}
          >
            {section.title}
          </h3>
          {onRemoveSection && (
            <button
              className="section-remove-btn"
              onClick={(e) => { e.stopPropagation(); onRemoveSection(sectionPath); }}
              title="Remove section"
            >
              ×
            </button>
          )}
        </div>
      )}
      {!section.title && onRemoveSection && (
        <div className="section-header section-header-untitled">
          <button
            className="section-remove-btn"
            onClick={(e) => { e.stopPropagation(); onRemoveSection(sectionPath); }}
            title="Remove section"
          >
            ×
          </button>
        </div>
      )}

      {inlinesChildren ? (
        /* Tables require inlining child <tr> rows into the parent HTML */
        <div
          className={`narrative-content${editable ? " narrative-content-editable" : ""}`}
          onClick={editable ? () => setNarrativeModalOpen(true) : undefined}
          dangerouslySetInnerHTML={{
            __html: buildSectionHtml(section, questionnaireIndex, showContext),
          }}
        />
      ) : (
        <SectionContentWithChildren
          section={section}
          depth={depth}
          questionnaireIndex={questionnaireIndex}

          showContext={showContext}
          sectionPath={sectionPath}
          editable={editable}
          onNarrativeClick={() => setNarrativeModalOpen(true)}
          onSectionHtmlChange={onSectionHtmlChange}
          onSectionTitleChange={onSectionTitleChange}
          onContextExpressionChange={onContextExpressionChange}
          onAddSection={onAddSection}
          onRemoveSection={onRemoveSection}
        />
      )}

      {/* Narrative editor modal */}
      {editable && (
        <NarrativeEditorModal
          open={narrativeModalOpen}
          onClose={() => setNarrativeModalOpen(false)}
          title={section.title}
          divHtml={section.text?.div ?? ""}
          questionnaireIndex={questionnaireIndex}

          contextExpression={contextExpr}
          onSave={(html, title) => {
            onSectionHtmlChange?.(sectionPath, html);
            onSectionTitleChange?.(sectionPath, title);
          }}
        />
      )}

      {/* Context expression editor modal */}
      {editable && (
        <ContextExpressionModal
          open={contextModalOpen}
          onClose={() => setContextModalOpen(false)}
          expression={contextExpr ?? ""}
          onSave={(expr) => onContextExpressionChange?.(sectionPath, expr)}
        />
      )}
    </div>
  );
}
