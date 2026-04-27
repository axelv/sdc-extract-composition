import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import type { CompositionSection } from "../../types";
import { $createSectionBlockNode } from "./SectionBlockNode";
import { $insertSectionsInto } from "./sections-tree-conversion";

interface SectionsImportPluginProps {
  sections: CompositionSection[];
}

/**
 * One-shot import: clears the editor on mount and inserts the section tree
 * as nested SectionBlockNodes. Re-mount the LexicalComposer (via React `key`)
 * to import a different tree.
 */
export function SectionsImportPlugin({ sections }: SectionsImportPluginProps) {
  const [editor] = useLexicalComposerContext();
  const importedRef = useRef(false);

  useEffect(() => {
    if (importedRef.current) return;
    importedRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (sections.length === 0) {
        root.append($createSectionBlockNode({}));
      } else {
        $insertSectionsInto(root, sections);
      }
    });
  }, [editor, sections]);

  return null;
}
