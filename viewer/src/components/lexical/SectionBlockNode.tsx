import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, ElementNode } from "lexical";
import type { CompositionSection, Extension, Narrative } from "../../types";

export interface OpaqueSectionMeta {
  code?: CompositionSection["code"];
  text?: Narrative;
  extension?: Extension[];
}

export type SerializedSectionBlockNode = Spread<
  { meta: OpaqueSectionMeta },
  SerializedElementNode
>;

export class SectionBlockNode extends ElementNode {
  __meta: OpaqueSectionMeta;

  static getType(): string {
    return "section-block";
  }

  static clone(node: SectionBlockNode): SectionBlockNode {
    return new SectionBlockNode(node.__meta, node.__key);
  }

  constructor(meta: OpaqueSectionMeta = {}, key?: NodeKey) {
    super(key);
    this.__meta = meta;
  }

  afterCloneFrom(prev: this): void {
    super.afterCloneFrom(prev);
    this.__meta = prev.__meta;
  }

  static importJSON(json: SerializedSectionBlockNode): SectionBlockNode {
    return $createSectionBlockNode(json.meta).updateFromJSON(json);
  }

  exportJSON(): SerializedSectionBlockNode {
    return { ...super.exportJSON(), meta: this.__meta };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement("div");
    el.className = "section-block";
    return el;
  }

  updateDOM(): false {
    return false;
  }

  insertNewAfter(): SectionBlockNode {
    const sibling = $createSectionBlockNode({});
    this.insertAfter(sibling);
    return sibling;
  }

  canBeEmpty(): true {
    return true;
  }

  isShadowRoot(): false {
    return false;
  }

  getMeta(): OpaqueSectionMeta {
    return this.getLatest().__meta;
  }

  setMeta(meta: OpaqueSectionMeta): this {
    const writable = this.getWritable();
    writable.__meta = meta;
    return writable;
  }
}

export function $createSectionBlockNode(
  meta: OpaqueSectionMeta = {},
): SectionBlockNode {
  return $applyNodeReplacement(new SectionBlockNode(meta));
}

export function $isSectionBlockNode(
  node: LexicalNode | null | undefined,
): node is SectionBlockNode {
  return node instanceof SectionBlockNode;
}
