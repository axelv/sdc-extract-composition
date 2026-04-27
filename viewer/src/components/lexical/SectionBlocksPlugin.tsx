import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type LexicalNode,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import {
  $createSectionBlockNode,
  $isSectionBlockNode,
  type SectionBlockNode,
} from "./SectionBlockNode";

function $findEnclosingSectionBlock(
  node: LexicalNode | null,
): SectionBlockNode | null {
  let cur: LexicalNode | null = node;
  while (cur) {
    if ($isSectionBlockNode(cur)) return cur;
    cur = cur.getParent();
  }
  return null;
}

/**
 * Select the title text of `block`. Placing the cursor on the title TextNode
 * (rather than walking to the deepest descendant via selectEnd) keeps the
 * cursor on the current block even when it has nested children.
 */
function $selectBlockTitle(block: SectionBlockNode): void {
  const titleText = block.getChildren().find($isTextNode);
  if (titleText) {
    titleText.select(
      titleText.getTextContentSize(),
      titleText.getTextContentSize(),
    );
  } else {
    block.selectStart();
  }
}

/**
 * Notion-like keyboard semantics for the section block tree:
 *  - Tab           → nest under previous sibling section (INDENT_CONTENT_COMMAND)
 *  - Shift+Tab     → outdent to grandparent (OUTDENT_CONTENT_COMMAND)
 *  - Enter         → create empty sibling section after current
 *  - Backspace     → on empty top-of-block, outdent if nested
 *
 * `TabIndentationPlugin` from @lexical/react routes Tab/Shift+Tab into
 * INDENT_CONTENT_COMMAND / OUTDENT_CONTENT_COMMAND, so we only need to
 * handle the commands themselves here.
 */
export function SectionBlocksPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return false;
          const block = $findEnclosingSectionBlock(sel.anchor.getNode());
          if (!block) return false;
          event?.preventDefault();
          editor.dispatchCommand(
            event?.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
            undefined,
          );
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return false;
          const block = $findEnclosingSectionBlock(sel.anchor.getNode());
          if (!block) return false;

          const prev = block.getPreviousSibling();
          if (!$isSectionBlockNode(prev)) return true; // first child — no-op
          block.remove();
          prev.append(block);
          $selectBlockTitle(block);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        OUTDENT_CONTENT_COMMAND,
        () => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return false;
          const block = $findEnclosingSectionBlock(sel.anchor.getNode());
          if (!block) return false;

          const parent = block.getParent();
          if (!$isSectionBlockNode(parent)) return true; // already top-level
          block.remove();
          parent.insertAfter(block);
          $selectBlockTitle(block);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
          const block = $findEnclosingSectionBlock(sel.anchor.getNode());
          if (!block) return false;

          event?.preventDefault();
          const sibling = $createSectionBlockNode({});
          block.insertAfter(sibling);
          sibling.selectStart();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
          if (sel.anchor.offset !== 0) return false;

          const block = $findEnclosingSectionBlock(sel.anchor.getNode());
          if (!block) return false;

          const titleText = block
            .getChildren()
            .filter($isTextNode)
            .map((t) => t.getTextContent())
            .join("");
          if (titleText.length > 0) return false;

          const hasNested = block.getChildren().some($isSectionBlockNode);
          if (hasNested) return false;

          const parent = block.getParent();
          if (!$isSectionBlockNode(parent)) return false;

          event?.preventDefault();
          block.remove();
          parent.insertAfter(block);
          block.selectStart();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);

  return null;
}
