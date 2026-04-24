import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createTextNode, $isTextNode, TextNode } from "lexical";
import { mergeRegister } from "@lexical/utils";
import { $createFhirPathPillNode } from "./FhirPathPillNode";
import {
  $createEditingFhirPathNode,
  $isEditingFhirPathNode,
  EditingFhirPathNode,
} from "./EditingFhirPathNode";

const PLACEHOLDER_RE = /\{\{([^{}]*)\}\}/;

/**
 * Drives the in-flight → pill state machine for FHIRPath expressions:
 *
 * 1. Plain TextNode with `{{…}}` (fully closed) → split out the match and
 *    replace it with a FhirPathPillNode. Any trailing text becomes a sibling
 *    TextNode (caret parked at its start).
 * 2. Plain TextNode with `{{` but no `}}` → split at `{{`, wrap the `{{…`
 *    tail in an EditingFhirPathNode so the user sees they're composing an
 *    expression and further typing stays inside the wrapper.
 * 3. TextNode inside an EditingFhirPathNode whose content has become
 *    `{{…}}` → replace the wrapper with a FhirPathPillNode.
 * 4. TextNode inside an EditingFhirPathNode whose content no longer contains
 *    `{{` (user deleted the braces) → unwrap back to plain text.
 */
export function FhirPathPillFinalizePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // When text is typed at the caret sitting just after the inline
    // EditingFhirPathNode, browsers dispatch `beforeinput` at the DOM
    // boundary outside the span, so Lexical creates a sibling TextNode
    // rather than extending the inner child. Absorb those siblings back
    // into the wrapper so the finalize regex can see `{{…}}` in one node.
    const absorb = editor.registerNodeTransform(
      EditingFhirPathNode,
      (wrapper) => {
        const next = wrapper.getNextSibling();
        if (!$isTextNode(next)) return;
        const last = wrapper.getLastChild();
        if (!$isTextNode(last)) return;
        const merged = last.getTextContent() + next.getTextContent();
        last.setTextContent(merged);
        next.remove();
        last.select(merged.length, merged.length);
      },
    );

    const transform = editor.registerNodeTransform(TextNode, (node) => {
      const parent = node.getParent();
      const insideEditing = $isEditingFhirPathNode(parent);
      const text = node.getTextContent();
      const match = PLACEHOLDER_RE.exec(text);

      // Case 3 / 1: complete `{{…}}` — crystallize into a pill.
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        const expression = match[1].trim();
        const before = text.slice(0, start);
        const after = text.slice(end);
        const pill = $createFhirPathPillNode(expression);
        const trailing = $createTextNode(after);

        if (insideEditing && before === "" && after === "") {
          // Whole editing wrapper crystallizes — swap wrapper for pill.
          parent.insertAfter(pill);
          pill.insertAfter(trailing);
          parent.remove();
        } else if (insideEditing) {
          // Unusual: user pasted extra content around `{{…}}` inside the
          // wrapper. Unwrap the text and then split/pill it in the
          // grandparent.
          parent.insertAfter(node);
          parent.remove();
          if (before === "") {
            node.replace(pill);
          } else {
            node.setTextContent(before);
            node.insertAfter(pill);
          }
          pill.insertAfter(trailing);
        } else {
          if (before === "") {
            node.replace(pill);
          } else {
            node.setTextContent(before);
            node.insertAfter(pill);
          }
          pill.insertAfter(trailing);
        }
        trailing.select(0, 0);
        return;
      }

      // Case 4: user deleted `{{` while editing — unwrap.
      if (insideEditing && !text.includes("{{")) {
        parent.insertAfter(node);
        parent.remove();
        return;
      }

      // Case 2: unclosed `{{` outside a wrapper — wrap the `{{…` tail.
      if (!insideEditing) {
        const openIdx = text.indexOf("{{");
        if (openIdx === -1) return;
        // Bail if there's also a `}}` later — the match branch above handles it.
        if (text.indexOf("}}", openIdx + 2) !== -1) return;

        const before = text.slice(0, openIdx);
        const inside = text.slice(openIdx);
        const inner = $createTextNode(inside);
        const wrapper = $createEditingFhirPathNode();
        wrapper.append(inner);

        if (before === "") {
          node.replace(wrapper);
        } else {
          node.setTextContent(before);
          node.insertAfter(wrapper);
        }
        inner.select(inside.length, inside.length);
      }
    });

    return mergeRegister(absorb, transform);
  }, [editor]);

  return null;
}
