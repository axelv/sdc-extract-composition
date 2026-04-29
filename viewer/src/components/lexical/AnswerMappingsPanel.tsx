import { useCallback, useMemo } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { $isFhirPathPillNode } from "./FhirPathPillNode";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";
import {
  parseExpression,
  formatExpression,
  getMapMappings,
  setMapMappings,
  type CodeMapping,
} from "../../utils/filter-pipeline";
import { segmentExpression } from "../../utils/expression-pills";
import type { AnswerOption } from "../../utils/questionnaire-index";

interface AnswerMappingsPanelProps {
  nodeKey: NodeKey;
  expression: string;
}

interface OptionWithMapping {
  code: string;
  display: string;
  mappedText: string;
  isOrphaned: boolean;
}

export function AnswerMappingsPanel({ nodeKey, expression }: AnswerMappingsPanelProps) {
  const [editor] = useLexicalComposerContext();
  const index = useQuestionnaireIndex();

  // Get answerOptions from the questionnaire for this expression's linkId
  const answerOptions = useMemo((): AnswerOption[] => {
    if (!index) return [];
    const segments = segmentExpression(expression);
    for (const seg of segments) {
      if (seg.kind === "answer-pill" && seg.linkIds.length > 0) {
        const leafLinkId = seg.linkIds[seg.linkIds.length - 1];
        return index.listAnswerCodings(leafLinkId);
      }
    }
    return [];
  }, [expression, index]);

  // Parse current mappings from expression
  const parsed = useMemo(() => parseExpression(expression), [expression]);
  const currentMappings = useMemo(() => getMapMappings(parsed), [parsed]);

  // Build unified list: questionnaire options + any orphaned mappings
  const optionsWithMappings = useMemo((): OptionWithMapping[] => {
    const mappingByCode = new Map(currentMappings.map(m => [m.code, m.text]));
    const seenCodes = new Set<string>();

    // Start with questionnaire options
    const result: OptionWithMapping[] = answerOptions.map(opt => {
      seenCodes.add(opt.code);
      return {
        code: opt.code,
        display: opt.display ?? opt.code,
        mappedText: mappingByCode.get(opt.code) ?? "",
        isOrphaned: false,
      };
    });

    // Add orphaned mappings (codes no longer in questionnaire)
    for (const m of currentMappings) {
      if (!seenCodes.has(m.code)) {
        result.push({
          code: m.code,
          display: m.code,
          mappedText: m.text,
          isOrphaned: true,
        });
      }
    }

    return result;
  }, [answerOptions, currentMappings]);

  // Update a single mapping
  const updateMapping = useCallback((code: string, text: string) => {
    const newMappings: CodeMapping[] = [];

    // Keep existing mappings, updating the one that changed
    let found = false;
    for (const m of currentMappings) {
      if (m.code === code) {
        if (text.trim()) {
          newMappings.push({ code, text: text.trim() });
        }
        found = true;
      } else {
        newMappings.push(m);
      }
    }

    // Add new mapping if not found and text is non-empty
    if (!found && text.trim()) {
      newMappings.push({ code, text: text.trim() });
    }

    const newParsed = setMapMappings(parsed, newMappings);
    const newExpression = formatExpression(newParsed);

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isFhirPathPillNode(node)) {
        node.setExpression(newExpression);
      }
    });
  }, [editor, nodeKey, parsed, currentMappings]);

  // Remove an orphaned mapping
  const removeOrphanedMapping = useCallback((code: string) => {
    const newMappings = currentMappings.filter(m => m.code !== code);
    const newParsed = setMapMappings(parsed, newMappings);
    const newExpression = formatExpression(newParsed);

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isFhirPathPillNode(node)) {
        node.setExpression(newExpression);
      }
    });
  }, [editor, nodeKey, parsed, currentMappings]);

  // Only show panel if there's a map filter in the expression
  const hasMapFilter = parsed.filters.some(f => f.name === "map");
  if (!hasMapFilter) {
    return null;
  }

  const hasOrphans = optionsWithMappings.some(o => o.isOrphaned);

  return (
    <div className="answer-mappings-panel">
      <div className="answer-mappings-header">
        Answer Mappings
        {hasOrphans && <span className="answer-mappings-warning">!</span>}
      </div>
      <div className="answer-mappings-body">
        {optionsWithMappings.map(opt => (
          <div
            key={opt.code}
            className={`answer-mappings-row ${opt.isOrphaned ? "orphaned" : ""}`}
          >
            <div className="answer-mappings-display">
              {opt.display}
              {opt.isOrphaned && (
                <span className="answer-mappings-orphan-badge">removed</span>
              )}
            </div>
            {opt.isOrphaned ? (
              <div className="answer-mappings-orphan-actions">
                <span className="answer-mappings-orphan-text">{opt.mappedText}</span>
                <button
                  type="button"
                  className="answer-mappings-remove"
                  onClick={() => removeOrphanedMapping(opt.code)}
                  title="Remove orphaned mapping"
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="text"
                className="answer-mappings-input"
                value={opt.mappedText}
                onChange={(e) => updateMapping(opt.code, e.target.value)}
                placeholder={`(use "${opt.display}")`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
