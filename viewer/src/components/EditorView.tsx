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
  onAIQuickStart?: (preset?: string) => void;
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

const AI_PRESETS = [
  { id: "compact", title: "Compact", desc: "Short, condensed text", prompt: "Create a compact, condensed narrative with minimal text." },
  { id: "bullets", title: "Bullets", desc: "Structured with bullet points", prompt: "Create a structured document using bullet points for each item." },
  { id: "elaborate", title: "Elaborate", desc: "Detailed full sentences", prompt: "Create an elaborate, detailed narrative with full sentences." },
  { id: "laymen", title: "Laymen", desc: "Simple, patient-friendly", prompt: "Create a patient-friendly document using simple, laymen's language that avoids medical jargon." },
];

export function EditorView({
  composition,
  questionnaireIndex,
  onSectionChange,
  onAddSection,
  onRemoveSection,
  onAIQuickStart,
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
            {onAIQuickStart && (
              <>
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                    <circle cx="8.5" cy="14.5" r="1.5"/>
                    <circle cx="15.5" cy="14.5" r="1.5"/>
                  </svg>
                </div>
                <h2 className="empty-state-title">Generate with Tiro AI</h2>
                <p className="empty-state-subtitle">Choose a style to get started instantly</p>
                <div className="empty-state-presets">
                  {AI_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className="empty-state-preset"
                      onClick={() => onAIQuickStart(preset.prompt)}
                    >
                      <span className="empty-state-preset-title">{preset.title}</span>
                      <span className="empty-state-preset-desc">{preset.desc}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="empty-state-custom"
                  onClick={() => onAIQuickStart()}
                >
                  Custom instructions...
                </button>
                <div className="empty-state-divider">or</div>
              </>
            )}
            <button
              className="empty-state-btn"
              onClick={() => onAddSection([], 0)}
            >
              Add section
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
