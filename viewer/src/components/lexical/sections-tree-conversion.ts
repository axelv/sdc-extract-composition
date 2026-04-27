import type { ElementNode } from "lexical";
import { $createTextNode, $isTextNode } from "lexical";
import type { CompositionSection } from "../../types";
import {
  $createSectionBlockNode,
  $isSectionBlockNode,
  type OpaqueSectionMeta,
} from "./SectionBlockNode";

function extractMeta(s: CompositionSection): OpaqueSectionMeta {
  const meta: OpaqueSectionMeta = {};
  if (s.code !== undefined) meta.code = s.code;
  if (s.text !== undefined) meta.text = s.text;
  if (s.extension !== undefined) meta.extension = s.extension;
  return meta;
}

export function $insertSectionsInto(
  parent: ElementNode,
  sections: CompositionSection[],
): void {
  for (const s of sections) {
    const block = $createSectionBlockNode(extractMeta(s));
    if (s.title) block.append($createTextNode(s.title));
    parent.append(block);
    if (s.section?.length) $insertSectionsInto(block, s.section);
  }
}

export function $extractSections(parent: ElementNode): CompositionSection[] {
  const result: CompositionSection[] = [];
  for (const child of parent.getChildren()) {
    if (!$isSectionBlockNode(child)) continue;

    const titleParts: string[] = [];
    for (const inner of child.getChildren()) {
      if ($isTextNode(inner)) titleParts.push(inner.getTextContent());
    }
    const title = titleParts.join("").trim();

    const childSections = $extractSections(child);
    const section: CompositionSection = { ...child.getMeta() };
    if (title) section.title = title;
    if (childSections.length) section.section = childSections;
    result.push(section);
  }
  return result;
}
