import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  $createNodeSelection,
  $getNodeByKey,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from "lexical";
import { segmentExpressionToHtml } from "../../utils/expression-pills";
import { useWasmReady } from "../../utils/wasm-init";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";

interface FhirPathPillComponentProps {
  expression: string;
  nodeKey: NodeKey;
}

export function FhirPathPillComponent({
  expression,
  nodeKey,
}: FhirPathPillComponentProps) {
  const [editor] = useLexicalComposerContext();
  const pillRef = useRef<HTMLElement>(null);
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const questionnaireIndex = useQuestionnaireIndex();
  // Subscribe so the pill label recomputes when wasm finishes loading.
  useWasmReady();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (
            !pillRef.current ||
            !pillRef.current.contains(event.target as Node)
          ) {
            return false;
          }
          event.preventDefault();
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (!node) return;
            const selection = $createNodeSelection();
            selection.add(nodeKey);
            $setSelection(selection);
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, isSelected, nodeKey]);

  const pillHtml = segmentExpressionToHtml(expression, questionnaireIndex);

  return (
    <code
      ref={pillRef}
      className={`fhirpath-pill${isSelected ? " fhirpath-pill-selected" : ""}`}
      title={expression}
      dangerouslySetInnerHTML={{ __html: pillHtml }}
    />
  );
}
