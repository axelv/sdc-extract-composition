import { useEffect, useState, useCallback, useMemo } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  type NodeKey,
} from "lexical";
import { $isFhirPathPillNode } from "./FhirPathPillNode";
import {
  parseExpression,
  formatExpression,
  type FilterInvocation,
  type FilterLiteral,
} from "../../utils/filter-pipeline";
import {
  filtersForShape,
  getFilterSpec,
  HIDDEN_FILTERS,
  PANEL_FILTERS,
  type FilterSpec,
} from "../../utils/filter-catalog";
import { inferAnswerShape } from "../../utils/expression-type";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";
import { useDebugMode } from "../../contexts/DebugContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SelectedPill {
  nodeKey: NodeKey;
  expression: string;
}

interface SortableChipProps {
  id: string;
  filter: FilterInvocation;
  realIndex: number;
  onRemove: (index: number) => void;
  onArgChange: (filterIndex: number, argIndex: number, value: FilterLiteral) => void;
  isAnyDragging: boolean;
}

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

function SortableChip({ id, filter, realIndex, onRemove, onArgChange, isAnyDragging }: SortableChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id, animateLayoutChanges });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: isAnyDragging && !isDragging ? 'transform 100ms ease-out' : undefined,
  };

  const spec = getFilterSpec(filter.name);
  const hasPanel = PANEL_FILTERS.has(filter.name);

  return (
    <span ref={setNodeRef} style={style} className="formula-bar-chip">
      <span className="formula-bar-chip-handle" {...attributes} {...listeners}>
        ⋮
      </span>
      <span className="formula-bar-chip-name">
        {spec?.label ?? filter.name}
      </span>
      {!hasPanel && filter.args.length > 0 && spec?.args && (
        <>
          <span className="formula-bar-chip-sep">:</span>
          {filter.args.map((arg, argIdx) => (
            <input
              key={argIdx}
              type={spec.args[argIdx]?.kind === "number" ? "number" : "text"}
              className="formula-bar-chip-input"
              value={arg?.toString() ?? ""}
              onChange={(e) => {
                const val = spec.args[argIdx]?.kind === "number"
                  ? Number(e.target.value) || 0
                  : e.target.value;
                onArgChange(realIndex, argIdx, val);
              }}
              placeholder={spec.args[argIdx]?.placeholder}
            />
          ))}
        </>
      )}
      <button
        type="button"
        className="formula-bar-chip-remove"
        onClick={() => onRemove(realIndex)}
        title="Remove"
      >
        ×
      </button>
    </span>
  );
}

export function FormulaBar() {
  const debugMode = useDebugMode();
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState<SelectedPill | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const index = useQuestionnaireIndex();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) {
          setSelected(null);
          return;
        }
        const nodes = selection.getNodes();
        if (nodes.length !== 1) {
          setSelected(null);
          return;
        }
        const node = nodes[0];
        if (!$isFhirPathPillNode(node)) {
          setSelected(null);
          return;
        }
        const next: SelectedPill = {
          nodeKey: node.getKey(),
          expression: node.getExpression(),
        };
        setSelected((prev) => {
          if (
            prev &&
            prev.nodeKey === next.nodeKey &&
            prev.expression === next.expression
          ) {
            return prev;
          }
          return next;
        });
        setInputValue(node.getExpression());
      });
    });
  }, [editor]);

  const updateExpression = useCallback(
    (value: string) => {
      setInputValue(value);
      if (!selected) return;
      editor.update(() => {
        const node = $getNodeByKey(selected.nodeKey);
        if ($isFhirPathPillNode(node)) {
          node.setExpression(value);
        }
      });
    },
    [editor, selected]
  );

  // Parse expression to extract filters
  const parsed = useMemo(() => parseExpression(inputValue), [inputValue]);

  // Get visible filters (not hidden ones like designation)
  const visibleFilters = useMemo(
    () => parsed.filters.filter((f) => !HIDDEN_FILTERS.has(f.name)),
    [parsed.filters]
  );

  // Infer shape for filter suggestions
  const shape = useMemo(
    () => inferAnswerShape(inputValue, index),
    [inputValue, index]
  );

  const valueShape = shape?.valueShape ?? null;
  const offered = filtersForShape(valueShape);
  const used = new Set(parsed.filters.map((f) => f.name));
  const addable = offered.filter((spec) => !used.has(spec.name));

  const removeFilter = useCallback(
    (filterIndex: number) => {
      const newFilters = parsed.filters.filter((_, i) => i !== filterIndex);
      const newExpr = formatExpression({ ...parsed, filters: newFilters });
      updateExpression(newExpr);
    },
    [parsed, updateExpression]
  );

  const addFilter = useCallback(
    (spec: FilterSpec) => {
      const args: FilterLiteral[] = spec.args.map((a) =>
        a.kind === "number" ? 0 : ""
      );
      const newFilter: FilterInvocation = {
        name: spec.name,
        args,
        source: "",
      };
      const newFilters = [...parsed.filters, newFilter];
      const newExpr = formatExpression({ ...parsed, filters: newFilters });
      updateExpression(newExpr);
    },
    [parsed, updateExpression]
  );

  const updateFilterArg = useCallback(
    (filterIndex: number, argIndex: number, value: FilterLiteral) => {
      const newFilters = [...parsed.filters];
      const filter = newFilters[filterIndex];
      const newArgs = [...filter.args];
      newArgs[argIndex] = value;
      newFilters[filterIndex] = { ...filter, args: newArgs };
      const newExpr = formatExpression({ ...parsed, filters: newFilters });
      updateExpression(newExpr);
    },
    [parsed, updateExpression]
  );

  const moveFilter = useCallback(
    (oldIndex: number, newIndex: number) => {
      const newFilters = arrayMove(parsed.filters, oldIndex, newIndex);
      const newExpr = formatExpression({ ...parsed, filters: newFilters });
      updateExpression(newExpr);
    },
    [parsed, updateExpression]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(() => {
    setIsDraggingAny(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDraggingAny(false);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = visibleFilters.findIndex(
          (f) => `filter-${parsed.filters.indexOf(f)}` === active.id
        );
        const newIndex = visibleFilters.findIndex(
          (f) => `filter-${parsed.filters.indexOf(f)}` === over.id
        );
        if (oldIndex !== -1 && newIndex !== -1) {
          const oldRealIndex = parsed.filters.indexOf(visibleFilters[oldIndex]);
          const newRealIndex = parsed.filters.indexOf(visibleFilters[newIndex]);
          moveFilter(oldRealIndex, newRealIndex);
        }
      }
    },
    [visibleFilters, parsed.filters, moveFilter]
  );

  const isActive = selected !== null;

  const sortableIds = visibleFilters.map(
    (f) => `filter-${parsed.filters.indexOf(f)}`
  );

  return (
    <div className="formula-bar-container">
      {/* Expression row - only visible in debug mode */}
      {debugMode && (
        <div className={`formula-bar ${isActive ? "formula-bar-active" : ""}`}>
          <span className="formula-bar-label">fx</span>
          {isActive ? (
            <input
              type="text"
              className="formula-bar-input"
              value={inputValue}
              readOnly
              spellCheck={false}
            />
          ) : (
            <span className="formula-bar-placeholder">
              Select a field to edit
            </span>
          )}
        </div>
      )}

      {/* Formatting row - always visible */}
      <div className="formula-bar-formats">
        <span className="formula-bar-formats-label">Format:</span>
        <div className="formula-bar-chips">
          {isActive ? (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortableIds}
                  strategy={rectSortingStrategy}
                >
                  {visibleFilters.map((filter) => {
                    const realIndex = parsed.filters.indexOf(filter);
                    const id = `filter-${realIndex}`;
                    return (
                      <SortableChip
                        key={id}
                        id={id}
                        filter={filter}
                        realIndex={realIndex}
                        onRemove={removeFilter}
                        onArgChange={updateFilterArg}
                        isAnyDragging={isDraggingAny}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
              {addable.length > 0 && (
                <select
                  className="formula-bar-add-filter"
                  value=""
                  onChange={(e) => {
                    const spec = addable.find((s) => s.name === e.target.value);
                    if (spec) addFilter(spec);
                  }}
                >
                  <option value="" disabled hidden>+</option>
                  {addable.map((spec) => (
                    <option key={spec.name} value={spec.name}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              )}
              {visibleFilters.length === 0 && addable.length === 0 && (
                <span className="formula-bar-formats-empty">None</span>
              )}
            </>
          ) : (
            <span className="formula-bar-formats-empty">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
