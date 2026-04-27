import { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  type NodeKey,
} from "lexical";
import { $isFhirPathPillNode } from "./FhirPathPillNode";
import { FhirPathExpressionEditor } from "./FhirPathExpressionEditor";
import { SynonymsPanel } from "./SynonymsPanel";
import { inferAnswerShape } from "../../utils/expression-type";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";
import { useWasmReady } from "../../utils/wasm-init";

interface PillEditingWorkspaceProps {
  contextExpression?: string | null;
}

interface SelectedPill {
  nodeKey: NodeKey;
  expression: string;
}

export function PillEditingWorkspace({
  contextExpression,
}: PillEditingWorkspaceProps) {
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState<SelectedPill | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isNodeSelection(selection)) {
          setSelected((prev) => (prev === null ? prev : null));
          return;
        }
        const nodes = selection.getNodes();
        if (nodes.length !== 1) {
          setSelected((prev) => (prev === null ? prev : null));
          return;
        }
        const node = nodes[0];
        if (!$isFhirPathPillNode(node)) {
          setSelected((prev) => (prev === null ? prev : null));
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
      });
    });
  }, [editor]);

  const handleChange = useCallback(
    (value: string) => {
      if (!selected) return;
      editor.update(() => {
        const node = $getNodeByKey(selected.nodeKey);
        if ($isFhirPathPillNode(node)) {
          node.setExpression(value);
        }
      });
    },
    [editor, selected],
  );

  // While a pill is selected, dismiss the workspace on Escape or on a
  // mousedown outside both the narrative editor root and the workspace
  // container. Clicks inside the CodeMirror side editor (and its tooltips,
  // which CM6 mounts inside the cm-editor by default) stay inside the
  // workspace ref, so they don't dismiss.
  useEffect(() => {
    if (!selected) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const root = editor.getRootElement();
      if (root && root.contains(target)) return;
      if (workspaceRef.current && workspaceRef.current.contains(target)) return;
      editor.update(() => {
        $setSelection(null);
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      editor.update(() => {
        $setSelection(null);
      });
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editor, selected]);

  // Re-render when wasm flips ready so the answer-shape badge updates.
  useWasmReady();
  const index = useQuestionnaireIndex();

  if (!selected) return null;

  const shape = inferAnswerShape(selected.expression, index);

  return (
    <div ref={workspaceRef} className="pill-editing-workspace">
      <div className="pill-editing-workspace-section">
        <div className="pill-editing-workspace-label">
          <span>FHIRPATH</span>
          {shape && (
            <span className="pill-editing-workspace-type" title={shapeTitle(shape)}>
              <span className="pill-editing-workspace-type-linkid">
                {shape.linkIds
                  .map((id) => index?.resolveItemText(id) ?? id)
                  .join(" → ")}
              </span>
              <span className="pill-editing-workspace-type-sep">·</span>
              <span className="pill-editing-workspace-type-shape">
                {shape.valueShape}
              </span>
            </span>
          )}
        </div>
        <FhirPathExpressionEditor
          key={selected.nodeKey}
          value={selected.expression}
          onChange={handleChange}
          contextExpression={contextExpression}
        />
      </div>
      <SynonymsPanel expression={selected.expression} />
    </div>
  );
}

function shapeTitle(shape: ReturnType<typeof inferAnswerShape>): string {
  if (!shape) return "";
  const parts = [`reads ${shape.linkIds.join(", ")}`];
  if (shape.itemType) parts.push(`item.type = ${shape.itemType}`);
  parts.push(`value shape = ${shape.valueShape}`);
  return parts.join(" • ");
}
