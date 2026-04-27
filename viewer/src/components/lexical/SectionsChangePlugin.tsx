import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import type { CompositionSection } from "../../types";
import { $extractSections } from "./sections-tree-conversion";

interface SectionsChangePluginProps {
  onChange: (sections: CompositionSection[]) => void;
}

/**
 * Reads the editor tree on every update and reports the derived
 * CompositionSection[] back via `onChange`.
 */
export function SectionsChangePlugin({ onChange }: SectionsChangePluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        onChange($extractSections($getRoot()));
      });
    });
  }, [editor, onChange]);

  return null;
}
