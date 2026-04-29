import { useCallback, useMemo } from "react";
import type {
  Condition,
  ConditionOperator,
  ConditionScope,
  CombineMode,
} from "../utils/context-expression";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";

interface ConditionBuilderProps {
  conditions: Condition[];
  combineMode: CombineMode;
  questionnaireIndex?: QuestionnaireIndex;
  onChange: (conditions: Condition[], combineMode: CombineMode) => void;
}

interface ConditionRowProps {
  condition: Condition;
  questionnaireIndex?: QuestionnaireIndex;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}

const BASE_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "exists", label: "exists" },
  { value: "not-exists", label: "not exists" },
];

const CODING_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "exists", label: "exists" },
  { value: "not-exists", label: "not exists" },
  { value: "equals", label: "=" },
  { value: "not-equals", label: "≠" },
];

const CODING_TYPES = new Set(["choice", "open-choice", "coding"]);

function ConditionRow({
  condition,
  questionnaireIndex,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const items = useMemo(() => {
    if (!questionnaireIndex) return [];
    return Array.from(questionnaireIndex.items.entries())
      .filter(([, info]) => info.type !== "group" && info.type !== "display")
      .map(([linkId, info]) => ({
        linkId,
        text: info.text,
        type: info.type,
      }));
  }, [questionnaireIndex]);

  const selectedItemInfo = useMemo(() => {
    if (!questionnaireIndex || !condition.linkId) return null;
    return questionnaireIndex.items.get(condition.linkId) ?? null;
  }, [questionnaireIndex, condition.linkId]);

  const isCodingType = selectedItemInfo ? CODING_TYPES.has(selectedItemInfo.type) : false;
  const operators = isCodingType ? CODING_OPERATORS : BASE_OPERATORS;

  const answerCodings = useMemo(() => {
    if (!selectedItemInfo?.answerCodings) return [];
    return Array.from(selectedItemInfo.answerCodings.values());
  }, [selectedItemInfo]);

  const needsValue =
    condition.operator === "equals" || condition.operator === "not-equals";

  const handleFieldChange = useCallback(
    (value: string) => {
      const [scope, linkId] = value.split(":", 2) as [ConditionScope, string];
      const newInfo = questionnaireIndex?.items.get(linkId);
      const newIsCoding = newInfo ? CODING_TYPES.has(newInfo.type) : false;
      const needsReset = !newIsCoding && (condition.operator === "equals" || condition.operator === "not-equals");

      onChange({
        ...condition,
        linkId,
        scope,
        operator: needsReset ? "exists" : condition.operator,
        value: undefined,
      });
    },
    [condition, onChange, questionnaireIndex]
  );

  const handleOperatorChange = useCallback(
    (operator: ConditionOperator) => {
      const newCondition = { ...condition, operator };
      if (operator === "exists" || operator === "not-exists") {
        delete newCondition.value;
      }
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleValueChange = useCallback(
    (system: string, code: string) => {
      onChange({ ...condition, value: { system, code } });
    },
    [condition, onChange]
  );

  const selectedValue = condition.linkId
    ? `${condition.scope || "resource"}:${condition.linkId}`
    : "";

  return (
    <div className="condition-row">
      <select
        className="condition-field-select"
        value={selectedValue}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        <option value="">Select field...</option>
        <optgroup label="%context (current scope)">
          {items.map((item) => (
            <option key={`context:${item.linkId}`} value={`context:${item.linkId}`}>
              {item.text || item.linkId}
            </option>
          ))}
        </optgroup>
        <optgroup label="%resource (entire form)">
          {items.map((item) => (
            <option key={`resource:${item.linkId}`} value={`resource:${item.linkId}`}>
              {item.text || item.linkId}
            </option>
          ))}
        </optgroup>
      </select>

      <select
        className="condition-operator-select"
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValue ? (
        answerCodings.length > 0 ? (
          <select
            className="condition-value-select"
            value={condition.value ? `${condition.value.system ?? ""}|${condition.value.code}` : ""}
            onChange={(e) => {
              const [system, code] = e.target.value.split("|");
              handleValueChange(system, code);
            }}
          >
            <option value="">Select value...</option>
            {answerCodings.map((opt) => (
              <option
                key={`${opt.system ?? ""}|${opt.code}`}
                value={`${opt.system ?? ""}|${opt.code}`}
              >
                {opt.display || opt.code}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="condition-value-input"
            placeholder="code"
            value={condition.value?.code ?? ""}
            onChange={(e) =>
              handleValueChange(condition.value?.system ?? "", e.target.value)
            }
          />
        )
      ) : (
        <div className="condition-value-placeholder">—</div>
      )}

      <button
        type="button"
        className="condition-remove-btn"
        onClick={onRemove}
        title="Remove condition"
      >
        ×
      </button>
    </div>
  );
}

export function ConditionBuilder({
  conditions,
  combineMode,
  questionnaireIndex,
  onChange,
}: ConditionBuilderProps) {
  const handleConditionChange = useCallback(
    (index: number, condition: Condition) => {
      const newConditions = [...conditions];
      newConditions[index] = condition;
      onChange(newConditions, combineMode);
    },
    [conditions, combineMode, onChange]
  );

  const handleConditionRemove = useCallback(
    (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      onChange(newConditions, combineMode);
    },
    [conditions, combineMode, onChange]
  );

  const handleAddCondition = useCallback(() => {
    const newCondition: Condition = {
      linkId: "",
      operator: "exists",
    };
    onChange([...conditions, newCondition], combineMode);
  }, [conditions, combineMode, onChange]);

  const handleCombineModeChange = useCallback(
    (mode: CombineMode) => {
      onChange(conditions, mode);
    },
    [conditions, onChange]
  );

  return (
    <div className="condition-builder">
      <div className="condition-builder-header">
        <span className="condition-builder-label">Show section when</span>
        <select
          className="condition-combine-select"
          value={combineMode}
          onChange={(e) => handleCombineModeChange(e.target.value as CombineMode)}
        >
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
        <span className="condition-builder-label">conditions match:</span>
      </div>

      <div className="condition-list">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            questionnaireIndex={questionnaireIndex}
            onChange={(c) => handleConditionChange(index, c)}
            onRemove={() => handleConditionRemove(index)}
          />
        ))}
      </div>

      <button
        type="button"
        className="condition-add-btn"
        onClick={handleAddCondition}
      >
        + Add condition
      </button>
    </div>
  );
}
