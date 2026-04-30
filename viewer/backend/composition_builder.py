"""
CompositionBuilder: State tracking and action recording for AI-generated compositions.

Tracks sections by ID and records all actions for frontend playback with animations.
"""

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class Action:
    """A single action that can be played back by the frontend."""

    type: Literal["add", "update", "delete"]
    id: str
    parent_id: str | None = None
    title: str | None = None
    content: str | None = None
    context_expression: str | None = None


@dataclass
class Section:
    """Internal representation of a section."""

    id: str
    title: str
    content: str
    context_expression: str
    parent_id: str | None
    children: list[str] = field(default_factory=list)


TEMPLATE_EXTRACT_CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext"
)


class CompositionBuilder:
    """
    Builds a FHIR Composition from tool calls.

    Tracks sections by ID and records actions for frontend animation playback.
    """

    def __init__(self, initial_composition: dict[str, Any] | None = None) -> None:
        self._sections: dict[str, Section] = {}
        self._root_ids: list[str] = []
        self._actions: list[Action] = []
        self._next_id = 1

        if initial_composition:
            self._load_composition(initial_composition)

    def _generate_id(self) -> str:
        """Generate a unique section ID."""
        section_id = f"sec_{self._next_id}"
        self._next_id += 1
        return section_id

    def _load_composition(self, composition: dict[str, Any]) -> None:
        """Load existing composition sections into internal state."""

        def load_sections(
            sections: list[dict[str, Any]], parent_id: str | None = None
        ) -> list[str]:
            ids = []
            for sec in sections:
                section_id = self._generate_id()
                title = sec.get("title", "")
                content = sec.get("text", {}).get("div", "")
                context_expression = ""
                for ext in sec.get("extension", []):
                    if ext.get("url") == TEMPLATE_EXTRACT_CONTEXT_URL:
                        context_expression = ext.get("valueString", "")
                        break

                child_ids: list[str] = []
                if sec.get("section"):
                    child_ids = load_sections(sec["section"], section_id)

                self._sections[section_id] = Section(
                    id=section_id,
                    title=title,
                    content=content,
                    context_expression=context_expression,
                    parent_id=parent_id,
                    children=child_ids,
                )
                ids.append(section_id)
            return ids

        if composition.get("section"):
            self._root_ids = load_sections(composition["section"])

    def add_section(
        self,
        title: str,
        content: str,
        context_expression: str = "",
        parent_id: str | None = None,
    ) -> str:
        """
        Add a new section.

        Args:
            title: Section title
            content: HTML content (the div inner content)
            context_expression: FHIRPath context expression (empty for "always")
            parent_id: Parent section ID (None for top-level)

        Returns:
            The new section's ID
        """
        if parent_id and parent_id not in self._sections:
            return f"Error: parent section '{parent_id}' not found"

        section_id = self._generate_id()
        section = Section(
            id=section_id,
            title=title,
            content=content,
            context_expression=context_expression,
            parent_id=parent_id,
            children=[],
        )
        self._sections[section_id] = section

        if parent_id:
            self._sections[parent_id].children.append(section_id)
        else:
            self._root_ids.append(section_id)

        self._actions.append(
            Action(
                type="add",
                id=section_id,
                parent_id=parent_id,
                title=title,
                content=content,
                context_expression=context_expression if context_expression else None,
            )
        )
        return section_id

    def update_section(
        self,
        section_id: str,
        title: str | None = None,
        content: str | None = None,
        context_expression: str | None = None,
    ) -> bool:
        """
        Update an existing section.

        Args:
            section_id: ID of section to update
            title: New title (None to keep current)
            content: New content (None to keep current)
            context_expression: New context expression (None to keep current)

        Returns:
            True if successful, False if section not found
        """
        if section_id not in self._sections:
            return False

        section = self._sections[section_id]
        if title is not None:
            section.title = title
        if content is not None:
            section.content = content
        if context_expression is not None:
            section.context_expression = context_expression

        self._actions.append(
            Action(
                type="update",
                id=section_id,
                title=title,
                content=content,
                context_expression=context_expression,
            )
        )
        return True

    def delete_section(self, section_id: str) -> bool:
        """
        Delete a section and all its children.

        Args:
            section_id: ID of section to delete

        Returns:
            True if successful, False if section not found
        """
        if section_id not in self._sections:
            return False

        section = self._sections[section_id]

        # Recursively delete children
        for child_id in section.children:
            self.delete_section(child_id)

        # Remove from parent's children list or root list
        if section.parent_id:
            parent = self._sections.get(section.parent_id)
            if parent and section_id in parent.children:
                parent.children.remove(section_id)
        else:
            if section_id in self._root_ids:
                self._root_ids.remove(section_id)

        del self._sections[section_id]

        self._actions.append(Action(type="delete", id=section_id))
        return True

    def get_actions(self) -> list[dict[str, Any]]:
        """Get all recorded actions for frontend playback."""
        return [
            {
                "type": action.type,
                "id": action.id,
                "parent_id": action.parent_id,
                "title": action.title,
                "content": action.content,
                "context_expression": action.context_expression,
            }
            for action in self._actions
        ]

    def build_composition(self) -> dict[str, Any]:
        """Build the final FHIR Composition from current state."""

        def build_section(section_id: str) -> dict[str, Any]:
            section = self._sections[section_id]
            result: dict[str, Any] = {"_id": section_id}

            if section.context_expression:
                result["extension"] = [
                    {
                        "url": TEMPLATE_EXTRACT_CONTEXT_URL,
                        "valueString": section.context_expression,
                    }
                ]

            if section.title:
                result["title"] = section.title

            result["text"] = {
                "status": "generated",
                "div": section.content
                if section.content.startswith("<div")
                else f'<div xmlns="http://www.w3.org/1999/xhtml">{section.content}</div>',
            }

            if section.children:
                result["section"] = [
                    build_section(child_id) for child_id in section.children
                ]

            return result

        return {
            "resourceType": "Composition",
            "id": "ai-generated-composition",
            "status": "preliminary",
            "type": {"text": "AI Generated Report"},
            "title": "AI Generated Composition",
            "section": [build_section(root_id) for root_id in self._root_ids],
        }

    def list_sections(self) -> str:
        """List all sections with their IDs for agent reference."""
        if not self._sections:
            return "No sections exist yet."

        lines = ["Current sections:"]

        def describe(section_id: str, indent: int = 0) -> None:
            section = self._sections[section_id]
            prefix = "  " * indent
            title_display = section.title or "(no title)"
            lines.append(f"{prefix}- {section_id}: {title_display}")
            for child_id in section.children:
                describe(child_id, indent + 1)

        for root_id in self._root_ids:
            describe(root_id)

        return "\n".join(lines)
