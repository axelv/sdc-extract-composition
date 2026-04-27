import { useId, useState, type FormEvent } from "react";
import type { AnswerOption } from "../../utils/questionnaire-index";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";
import { useQuestionnaireMutable } from "./QuestionnaireMutableContext";
import {
  clearDesignation,
  findDesignationValue,
  setDesignation,
} from "../../utils/supplement-editor";
import { segmentExpression } from "../../utils/expression-pills";
import { useWasmReady } from "../../utils/wasm-init";

// Form-level overrides are written as designations with a custom `use.code`
// of "override" — no system, no canonical SNOMED CT mapping. The renderer
// looks up this designation transparently; no `|| designation:` filter is
// added to the pill expression.
const OVERRIDE_USE = "override";

interface SynonymsPanelProps {
  expression: string;
}

export function SynonymsPanel({ expression }: SynonymsPanelProps) {
  // Subscribe so the panel recomputes once the wasm analyzer is loaded.
  useWasmReady();
  const index = useQuestionnaireIndex();
  const mutable = useQuestionnaireMutable();

  // segmentExpression() depends on the wasm analyzer being ready.
  // useWasmReady() above subscribes us to its readiness flip, so this
  // recomputes on each render and stays correct.
  const codings = collectCodings(expression, index);

  // Nothing coded reachable from this expression — hide the panel entirely
  // rather than show an empty list that can't do anything.
  if (codings.length === 0) return null;

  return (
    <div className="synonyms-panel">
      <div className="synonyms-panel-header">Synoniemen</div>
      <div className="synonyms-panel-body">
        {!mutable && (
          <div className="synonyms-empty">
            No editable Questionnaire bound — overrides are read-only.
          </div>
        )}
        <ul className="synonyms-code-list">
          {codings.map((entry) => (
            <CodeRow
              key={`${entry.linkId}::${entry.coding.system ?? ""}::${entry.coding.code}`}
              linkId={entry.linkId}
              coding={entry.coding}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface CodeRowProps {
  linkId: string;
  coding: AnswerOption;
}

function CodeRow({ linkId, coding }: CodeRowProps) {
  const mutable = useQuestionnaireMutable();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputId = useId();

  if (!mutable) {
    return (
      <li className="synonyms-code-row synonyms-code-row-readonly">
        <CodeHeader coding={coding} linkId={linkId} />
      </li>
    );
  }

  const { questionnaire, setQuestionnaire } = mutable;

  const existing = coding.system
    ? findDesignationValue(
        questionnaire,
        coding.system,
        coding.code,
        OVERRIDE_USE,
      )
    : null;

  const startEdit = () => {
    setEditing(true);
    setDraft(existing ?? "");
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coding.system) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next = setDesignation(questionnaire, {
      system: coding.system,
      code: coding.code,
      useToken: OVERRIDE_USE,
      value: trimmed,
    });
    setQuestionnaire(next);
    setEditing(false);
    setDraft("");
  };

  const remove = () => {
    if (!coding.system) return;
    const next = clearDesignation(questionnaire, {
      system: coding.system,
      code: coding.code,
      useToken: OVERRIDE_USE,
    });
    setQuestionnaire(next);
  };

  return (
    <li className="synonyms-code-row">
      <CodeHeader coding={coding} linkId={linkId} />
      {existing !== null && !editing && (
        <div className="synonyms-existing">
          <div className="synonyms-existing-row">
            <span className="synonyms-value">{existing}</span>
            <button
              type="button"
              className="synonyms-button-link"
              onClick={startEdit}
              title="Edit"
            >
              Edit
            </button>
            <button
              type="button"
              className="synonyms-button-link synonyms-button-danger"
              onClick={remove}
              title="Clear"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      {existing === null && !editing && (
        <div className="synonyms-add-row">
          <button
            type="button"
            className="synonyms-button"
            disabled={!coding.system}
            title={
              !coding.system
                ? "System missing on the answerOption — cannot write a supplement"
                : "Override display"
            }
            onClick={startEdit}
          >
            Override display
          </button>
        </div>
      )}
      {editing && (
        <form
          className="synonyms-edit-form"
          onSubmit={submit}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.preventDefault();
              cancelEdit();
            }
          }}
        >
          <label className="synonyms-edit-label" htmlFor={inputId}>
            Render code <code>{coding.code}</code> as:
          </label>
          <input
            id={inputId}
            type="text"
            className="synonyms-edit-input"
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            placeholder={coding.display ?? coding.code}
            autoFocus
          />
          <div className="synonyms-edit-actions">
            <button
              type="button"
              className="synonyms-button"
              onClick={cancelEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="synonyms-button synonyms-button-primary"
              disabled={draft.trim().length === 0}
            >
              Save
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function CodeHeader({
  coding,
  linkId,
}: {
  coding: AnswerOption;
  linkId: string;
}) {
  return (
    <div className="synonyms-code-header">
      <code className="synonyms-code-token">{coding.code}</code>
      <span className="synonyms-code-display">
        {coding.display ?? "(no display)"}
      </span>
      <span className="synonyms-code-linkid" title={`from linkId ${linkId}`}>
        {linkId}
      </span>
    </div>
  );
}

interface CodeWithLinkId {
  linkId: string;
  coding: AnswerOption;
}

function collectCodings(
  expression: string,
  index: ReturnType<typeof useQuestionnaireIndex>,
): CodeWithLinkId[] {
  if (!index) return [];
  const segments = segmentExpression(expression);
  const linkIds = new Set<string>();
  for (const seg of segments) {
    if (seg.kind === "answer-pill") {
      // The leaf linkId is the most specific reference.
      const leaf = seg.linkIds[seg.linkIds.length - 1];
      if (leaf) linkIds.add(leaf);
    } else if (seg.kind === "code-pill") {
      linkIds.add(seg.contextLinkId);
    }
  }
  const out: CodeWithLinkId[] = [];
  const seen = new Set<string>();
  for (const linkId of linkIds) {
    for (const coding of index.listAnswerCodings(linkId)) {
      const key = `${linkId}::${coding.system ?? ""}::${coding.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ linkId, coding });
    }
  }
  return out;
}
