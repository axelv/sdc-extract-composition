"""
AI Agent for generating FHIR Composition templates.

Uses pydantic-ai with Google Gemini to interpret natural language requests
and manipulate compositions via CRUD tools.
"""

from typing import Any

from pydantic_ai import Agent, DocumentUrl, RunContext
from pydantic_ai_harness import CodeMode

from composition_builder import CompositionBuilder

SYSTEM_PROMPT = """You are an AI assistant that helps create FHIR Composition templates for medical reports and letters.

## Your Role

You generate composition sections based on:
1. A questionnaire structure (items with linkIds, types, answer options)
2. A natural language description of the desired output
3. Optionally, an existing composition to modify

## Key Concepts

### Section Context Types

Each section can have a context expression that controls when it renders:

1. **Always** (no context expression): Section always appears
2. **Conditional (if)**: Section appears only when conditions are met
3. **Repeating (for-each)**: Section repeats for each item in a list

### Context Expression Patterns

**IMPORTANT: Always use these exact patterns. The UI parser expects these formats.**

**For conditional sections (show/hide based on condition):**
The expression MUST be wrapped in `%context.where(...)`:
```
%context.where(%context.item.where(linkId='LINK_ID').answer.exists())
%context.where(%context.item.where(linkId='LINK_ID').answer.exists().not())
%context.where(%context.item.where(linkId='LINK_ID').answer.value ~ %factory.Coding('SYSTEM', 'CODE'))
```

WRONG (don't use raw boolean expressions):
```
%resource.item.where(linkId='X').answer.exists()  ← WRONG, missing %context.where() wrapper
```

**For repeating sections (iterate over list):**
```
%resource.item.where(linkId='PARENT').item.where(linkId='REPEATING_ITEM')
%context.item.where(linkId='REPEATING_ITEM')
```

### Variable Expressions in Content

Embed values using double curly braces:
```
{{%resource.item.where(linkId='LINK_ID').answer.value}}
{{%context.item.where(linkId='LINK_ID').answer.value}}
```

Use `%resource` for root-level items, `%context` within repeating/conditional sections.

### Value Access Patterns

- String/Number: `.answer.value`
- Coding display: `.answer.value.display`
- Coding code: `.answer.value.code`
- Date: `.answer.value`
- Boolean: `.answer.value`

### Filters

Transform values with `||` separator:
```
{{expression || upcase}}
{{expression || default: "N/A"}}
{{expression || join: ", "}}
{{expression || map: "code1" => "text1", "code2" => "text2"}}
```

## Guidelines

1. **One section = one sentence/line**: Never split sentences across sections
2. **Use proper linkIds**: Always reference actual linkIds from the questionnaire
3. **Handle conditionals properly**: Create separate sections for different conditions
4. **Build hierarchically**: Use parent_id to nest sections logically
5. **Keep content simple**: Use plain text with embedded {{variables}}
6. **For repeating items**: Set context_expression to the repeating path, then use %context in content
7. **Titles are always rendered**: If you provide a title, it will appear as a heading in the output. For flowing prose without headings, leave title empty and put the text in content. Only use titles for actual section headers like "Patient Information" or "Medications".

## Tools Available

- `add_section`: Create a new section (optionally nested under parent_id)
- `update_section`: Modify an existing section
- `delete_section`: Remove a section

## Important

Just execute the tools. Do not explain what you did - the user sees the sections being created in real-time.
Reply with only "Done" after executing tools.
"""


def build_questionnaire_context(questionnaire: dict[str, Any]) -> str:
    """Extract relevant questionnaire structure for the agent."""
    lines = ["## Questionnaire Structure", ""]

    def describe_item(item: dict[str, Any], indent: int = 0) -> None:
        prefix = "  " * indent
        link_id = item.get("linkId", "unknown")
        text = item.get("text", link_id)
        item_type = item.get("type", "group")
        repeats = item.get("repeats", False)

        type_info = f"({item_type})"
        if repeats:
            type_info = f"({item_type}, repeats)"

        lines.append(f"{prefix}- `{link_id}`: {text} {type_info}")

        # Show answer options for choice items
        if item.get("answerOption"):
            for opt in item["answerOption"]:
                coding = opt.get("valueCoding", {})
                code = coding.get("code", "")
                display = coding.get("display", code)
                system = coding.get("system", "")
                if code:
                    lines.append(f"{prefix}  - Option: `{code}` = {display}")
                    if system:
                        lines.append(f"{prefix}    (system: {system})")

        # Recurse into children
        for child in item.get("item", []):
            describe_item(child, indent + 1)

    for item in questionnaire.get("item", []):
        describe_item(item)

    return "\n".join(lines)


agent = Agent(
    "google-gla:gemini-3.1-pro-preview",
    system_prompt=SYSTEM_PROMPT,
    deps_type=CompositionBuilder,
    capabilities=[CodeMode()],
)


@agent.tool
def add_section(
    ctx: RunContext[CompositionBuilder],
    title: str,
    content: str,
    context_expression: str = "",
    parent_id: str | None = None,
) -> str:
    """
    Add a new section to the composition.

    Args:
        title: Section title (can be empty for untitled sections)
        content: HTML content with {{variable}} placeholders
        context_expression: FHIRPath expression for conditional/repeating (empty for always)
        parent_id: ID of parent section (None for top-level)

    Returns:
        The new section's ID (e.g., "sec_1")
    """
    return ctx.deps.add_section(title, content, context_expression, parent_id)


@agent.tool
def update_section(
    ctx: RunContext[CompositionBuilder],
    section_id: str,
    title: str | None = None,
    content: str | None = None,
    context_expression: str | None = None,
) -> str:
    """
    Update an existing section.

    Args:
        section_id: ID of section to update (e.g., "sec_1")
        title: New title (None to keep current)
        content: New content (None to keep current)
        context_expression: New context expression (None to keep current)

    Returns:
        Success message or error
    """
    success = ctx.deps.update_section(section_id, title, content, context_expression)
    return f"Updated {section_id}" if success else f"Section {section_id} not found"


@agent.tool
def delete_section(ctx: RunContext[CompositionBuilder], section_id: str) -> str:
    """
    Delete a section and all its children.

    Args:
        section_id: ID of section to delete (e.g., "sec_1")

    Returns:
        Success message or error
    """
    success = ctx.deps.delete_section(section_id)
    return f"Deleted {section_id}" if success else f"Section {section_id} not found"


async def generate_composition(
    prompt: str,
    questionnaire: dict[str, Any],
    composition: dict[str, Any] | None = None,
    file_uri: str | None = None,
    file_mime: str | None = None,
    file_text: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any], str | None]:
    """
    Run the agent to generate/modify a composition.

    Args:
        prompt: User's natural language request
        questionnaire: FHIR Questionnaire for context
        composition: Optional existing composition to modify
        file_uri: Optional Google Files API URI for uploaded document
        file_mime: MIME type of the uploaded file
        file_text: Optional text content (e.g., from DOCX conversion)

    Returns:
        Tuple of (actions, final_composition, agent_message)
    """
    builder = CompositionBuilder(composition)

    # Build full prompt with questionnaire context
    questionnaire_context = build_questionnaire_context(questionnaire)
    full_prompt = f"{questionnaire_context}\n\n## User Request\n\n{prompt}"

    if composition:
        full_prompt += f"\n\n## Current Sections\n\n{builder.list_sections()}"

    # Build message parts - text first, then optional file
    message_parts: list[Any] = [full_prompt]

    if file_text:
        full_prompt += f"\n\n## Attached Document Content\n\n{file_text}"
        message_parts = [full_prompt]
    elif file_uri and file_mime:
        full_prompt += "\n\n## Attached Document\n\nUse the attached document as reference for creating sections."
        message_parts = [full_prompt, DocumentUrl(url=file_uri, media_type=file_mime)]

    await agent.run(message_parts, deps=builder)

    return (
        builder.get_actions(),
        builder.build_composition(),
        None,
    )
