import { useState } from "react";
import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import {
  getContextExpression,
  inferContextType,
  CONTEXT_ICONS,
} from "../utils/section-helpers";
import { NarrativeHtml } from "./NarrativeHtml";
import { AddBetweenButton } from "./AddBetweenButton";
import { SectionEditorModal } from "./lexical/SectionEditorModal";

interface EditorSectionCardProps {
  section: CompositionSection;
  sectionPath: number[];
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

export function EditorSectionCard({
  section,
  sectionPath,
  questionnaireIndex,
  onSectionChange,
  onAddSection,
  onRemoveSection,
}: EditorSectionCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const contextExpr = getContextExpression(section);
  const contextType = inferContextType(contextExpr);
  const contextIcon = CONTEXT_ICONS[contextType];

  const hasTitle = !!section.title?.trim();
  const hasContent = !!section.text?.div?.trim();
  const children = section.section ?? [];

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveSection(sectionPath);
  };

  const handleAddSubsection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSection(sectionPath);
  };

  const handleSave = (
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => {
    onSectionChange(sectionPath, newDivHtml, newTitle, newContextExpression);
  };

  return (
    <>
      <div className="editor-section-wrapper">
        <div
          className="editor-section"
          data-context={contextType}
          onClick={handleCardClick}
        >
          <span className="editor-context-icon">{contextIcon}</span>

          <button
            className="editor-delete-btn"
            onClick={handleDelete}
            title="Remove section"
          >
            &times;
          </button>

          <div className="editor-section-clickable">
            {hasTitle && (
              <div className="editor-section-title">{section.title}</div>
            )}
            {hasContent ? (
              <div className="editor-section-content">
                <NarrativeHtml
                  divHtml={section.text?.div ?? ""}
                  questionnaireIndex={questionnaireIndex}
                />
              </div>
            ) : (
              <div className="editor-section-content empty">
                Click to add content...
              </div>
            )}
          </div>

          {children.length > 0 && (
            <div
              className="editor-section-children"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setModalOpen(true);
                }
              }}
            >
              <AddBetweenButton
                onClick={() => onAddSection(sectionPath, 0)}
              />
              {children.map((child, i) => (
                <div key={i}>
                  <EditorSectionCard
                    section={child}
                    sectionPath={[...sectionPath, i]}
                    questionnaireIndex={questionnaireIndex}
                    onSectionChange={onSectionChange}
                    onAddSection={onAddSection}
                    onRemoveSection={onRemoveSection}
                  />
                  <AddBetweenButton
                    onClick={() => onAddSection(sectionPath, i + 1)}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            className="editor-subsection-btn"
            onClick={handleAddSubsection}
          >
            + subsection
          </button>
        </div>
      </div>

      <SectionEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={section.title}
        divHtml={section.text?.div ?? ""}
        questionnaireIndex={questionnaireIndex}
        contextExpression={contextExpr}
        onSave={handleSave}
      />
    </>
  );
}
