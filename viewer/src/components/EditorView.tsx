import type { Composition } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { CONTEXT_COLORS, CONTEXT_ICONS, CONTEXT_LABELS, type ContextType } from "../utils/section-helpers";
import { EditorSectionCard } from "./EditorSectionCard";
import { AddBetweenButton } from "./AddBetweenButton";
import "./editor-view.css";

interface EditorViewProps {
  composition: Composition;
  questionnaireIndex?: QuestionnaireIndex;
  onSectionChange: (
    sectionPath: number[],
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => void;
  onAddSection: (parentPath: number[], insertIndex?: number) => void;
  onRemoveSection: (sectionPath: number[]) => void;
}

function LegendItem({ type }: { type: ContextType }) {
  return (
    <div className="editor-legend-item">
      <span
        className="editor-legend-icon"
        style={{ background: CONTEXT_COLORS[type] }}
      >
        {CONTEXT_ICONS[type]}
      </span>
      <span>{CONTEXT_LABELS[type]}</span>
    </div>
  );
}

export function EditorView({
  composition,
  questionnaireIndex,
  onSectionChange,
  onAddSection,
  onRemoveSection,
}: EditorViewProps) {
  const sections = composition.section ?? [];

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Click any section to edit
        </div>
        <div className="editor-legend">
          <LegendItem type="always" />
          <LegendItem type="conditional" />
          <LegendItem type="repeating" />
        </div>
      </div>

      <div className="sections-container">
        {sections.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No sections yet</p>
            <button
              className="empty-state-btn"
              onClick={() => onAddSection([], 0)}
            >
              + Add first section
            </button>
          </div>
        ) : (
          <>
            <AddBetweenButton onClick={() => onAddSection([], 0)} />
            {sections.map((section, i) => (
              <div key={i}>
                <EditorSectionCard
                  section={section}
                  sectionPath={[i]}
                  questionnaireIndex={questionnaireIndex}
                  onSectionChange={onSectionChange}
                  onAddSection={onAddSection}
                  onRemoveSection={onRemoveSection}
                />
                <AddBetweenButton onClick={() => onAddSection([], i + 1)} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
