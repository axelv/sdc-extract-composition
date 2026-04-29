import { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isNodeSelection,
  $setSelection,
  type NodeKey,
} from "lexical";
import { $isFhirPathPillNode } from "./FhirPathPillNode";
import { AnswerMappingsPanel } from "./AnswerMappingsPanel";

interface SelectedPill {
  nodeKey: NodeKey;
  expression: string;
}

export function PillEditingWorkspace() {
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

  // While a pill is selected, dismiss the workspace on Escape or on a
  // mousedown outside both the narrative editor root and the workspace
  // container.
  useEffect(() => {
    if (!selected) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const root = editor.getRootElement();
      if (root && root.contains(target)) return;
      if (workspaceRef.current && workspaceRef.current.contains(target)) return;
      // Allow clicks anywhere inside the section editor modal (formula bar, buttons, etc.)
      if (target instanceof Element && target.closest(".section-editor-modal")) return;
      // Also check if active element is in section editor (for native select dropdowns)
      const active = document.activeElement;
      if (active instanceof Element && active.closest(".section-editor-modal")) return;
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

  if (!selected) return null;

  return (
    <div ref={workspaceRef} className="pill-editing-workspace">
      <AnswerMappingsPanel nodeKey={selected.nodeKey} expression={selected.expression} />
    </div>
  );
}
