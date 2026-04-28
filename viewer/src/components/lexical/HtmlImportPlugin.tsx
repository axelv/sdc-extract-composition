import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateNodesFromDOM } from "@lexical/html";
import {
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  type LexicalNode,
  type ParagraphNode,
} from "lexical";
import { stripDivWrapper } from "../../utils/parse-narrative";

interface HtmlImportPluginProps {
  divHtml: string;
}

/**
 * Pre-process narrative HTML so FhirPathPillNode.importDOM() can detect pills.
 * Replaces {{ expression }} with <code data-fhirpath-expression="expression">pill</code>.
 */
function preprocessPills(html: string): string {
  return html.replace(/\{\{(.*?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    const escaped = trimmed
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<code data-fhirpath-expression="${escaped}">\u200B</code>`;
  });
}

/**
 * Group inline runs (text, pills, inline elements) into paragraphs so the
 * results can be appended to RootNode, which only accepts non-inline children.
 */
function wrapInlineRuns(nodes: LexicalNode[]): LexicalNode[] {
  const result: LexicalNode[] = [];
  let paragraph: ParagraphNode | null = null;

  for (const node of nodes) {
    const isBlock = $isElementNode(node) && !node.isInline();
    if (isBlock) {
      paragraph = null;
      result.push(node);
    } else {
      if (!paragraph) {
        paragraph = $createParagraphNode();
        result.push(paragraph);
      }
      paragraph.append(node);
    }
  }

  return result;
}

/**
 * Plugin that imports narrative HTML into the Lexical editor on mount.
 * Converts {{ FHIRPath }} placeholders into FhirPathPillNode instances.
 */
export function HtmlImportPlugin({ divHtml }: HtmlImportPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const inner = stripDivWrapper(divHtml);
      const preprocessed = preprocessPills(inner);

      const parser = new DOMParser();
      const dom = parser.parseFromString(
        `<html><body>${preprocessed}</body></html>`,
        "text/html"
      );

      const nodes = $generateNodesFromDOM(editor, dom);
      root.append(...wrapInlineRuns(nodes));
    });
  }, [editor, divHtml]);

  return null;
}
