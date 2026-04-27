import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import type { ReactNode } from "react";
import { FhirPathPillComponent } from "./FhirPathPillComponent";

export type SerializedFhirPathPillNode = Spread<
  { expression: string },
  SerializedLexicalNode
>;

export class FhirPathPillNode extends DecoratorNode<ReactNode> {
  __expression: string;

  static getType(): string {
    return "fhirpath-pill";
  }

  static clone(node: FhirPathPillNode): FhirPathPillNode {
    return new FhirPathPillNode(node.__expression, node.__key);
  }

  constructor(expression: string, key?: NodeKey) {
    super(key);
    this.__expression = expression;
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__expression = prevNode.__expression;
  }

  // -- Serialization --

  static importJSON(json: SerializedFhirPathPillNode): FhirPathPillNode {
    return $createFhirPathPillNode(json.expression).updateFromJSON(json);
  }

  exportJSON(): SerializedFhirPathPillNode {
    return { ...super.exportJSON(), expression: this.__expression };
  }

  // -- DOM --

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  // HTML import: match <code data-fhirpath-expression="...">
  static importDOM(): DOMConversionMap | null {
    return {
      code: (domNode: HTMLElement) => {
        const expr = domNode.getAttribute("data-fhirpath-expression");
        if (expr == null) return null;
        return {
          conversion: () => ({
            node: $createFhirPathPillNode(expr),
          }),
          priority: 2,
        };
      },
    };
  }

  // HTML export: emit {{expression}} wrapped in a span
  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const span = document.createElement("span");
    span.textContent = `{{${this.__expression}}}`;
    return { element: span };
  }

  // -- Behavior --

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  getTextContent(): string {
    return `{{${this.__expression}}}`;
  }

  getExpression(): string {
    return this.getLatest().__expression;
  }

  setExpression(expression: string): this {
    const writable = this.getWritable();
    writable.__expression = expression;
    return writable;
  }

  // -- Decorator --

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactNode {
    return (
      <FhirPathPillComponent
        expression={this.__expression}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createFhirPathPillNode(
  expression: string
): FhirPathPillNode {
  return $applyNodeReplacement(new FhirPathPillNode(expression));
}

export function $isFhirPathPillNode(
  node: LexicalNode | null | undefined
): node is FhirPathPillNode {
  return node instanceof FhirPathPillNode;
}
