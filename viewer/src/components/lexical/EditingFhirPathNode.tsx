import {
  $applyNodeReplacement,
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
} from "lexical";

export type SerializedEditingFhirPathNode = SerializedElementNode;

/**
 * Inline wrapper shown while the user is composing a FHIRPath expression
 * (`{{` typed, `}}` not yet). Keeps the in-flight text in a single, visually
 * distinct container so (a) the user sees they're inside an expression, and
 * (b) new keystrokes stay inside this node — which lets the finalize
 * transform see `{{…}}` in one TextNode and convert it to a pill.
 *
 * This node is *transient*: it never serializes to persisted HTML. Any
 * unclosed expression left on save renders as plain `{{…` text via the
 * TextNode child's normal export path.
 */
export class EditingFhirPathNode extends ElementNode {
  static getType(): string {
    return "editing-fhirpath";
  }

  static clone(node: EditingFhirPathNode): EditingFhirPathNode {
    return new EditingFhirPathNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  static importJSON(): EditingFhirPathNode {
    return $createEditingFhirPathNode();
  }

  exportJSON(): SerializedEditingFhirPathNode {
    return { ...super.exportJSON() };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className = "fhirpath-editing";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  // Prevent Lexical from merging a sibling TextNode into this wrapper.
  canMergeWith(): boolean {
    return false;
  }

  // Disallow typing "before" / "after" boundaries from creating sibling
  // TextNodes outside the wrapper — new text always extends the inner child.
  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  // Transient node: do not include in copy/paste or HTML export output.
  excludeFromCopy(destination?: "clone" | "html"): boolean {
    return destination === "html";
  }
}

export function $createEditingFhirPathNode(): EditingFhirPathNode {
  return $applyNodeReplacement(new EditingFhirPathNode());
}

export function $isEditingFhirPathNode(
  node: LexicalNode | null | undefined,
): node is EditingFhirPathNode {
  return node instanceof EditingFhirPathNode;
}
