"""Composition template renderer with FHIRPath expression evaluation.

Ports the rendering logic from src/generate_html.py, providing the same
context resolution (parent_base propagation, indexed bases for repeating groups)
but returning structured HTML instead of a full HTML document.
"""

from __future__ import annotations

import html
import re
from typing import Any

import fhirpathpy
from fhirpathpy.models import models as fhir_models

R4_MODEL = fhir_models["r4"]


def _coding_equival(left: list, right: list) -> list:
    """Coding-aware ~ that compares code + system (if both present), ignoring display.

    fhirpathpy's default ~ does exact dict comparison, which fails when one
    side has extra fields like `display`. FHIR equivalence semantics for
    Coding match on `code` + `system` (when both present) and ignore `display`.
    Falls back to plain equality for non-Coding values.
    """
    if not left or not right:
        return [not left and not right]

    a, b = left[0], right[0]
    if isinstance(a, dict) and isinstance(b, dict) and "code" in a and "code" in b:
        if a["code"] != b["code"]:
            return [False]
        a_sys, b_sys = a.get("system"), b.get("system")
        if a_sys is not None and b_sys is not None and a_sys != b_sys:
            return [False]
        return [True]

    return [a == b]


_EVAL_OPTIONS = {
    "userInvocationTable": {
        "~": {"fn": _coding_equival, "arity": {2: ["Any", "Any"]}},
    },
}

PLACEHOLDER_PATTERN = re.compile(r"\{\{(.+?)\}\}")
SECTIONS_PLACEHOLDER = "<!-- sections -->"
TEMPLATE_EXTRACT_CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/"
    "sdc-questionnaire-templateExtractContext"
)

# Pattern for %factory.Coding('system', 'code') calls
FACTORY_CODING_PATTERN = re.compile(
    r"%factory\.Coding\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)"
)


def _rewrite_factory_calls(expression: str) -> tuple[str, dict[str, Any]]:
    """Replace %factory.Coding(...) calls with context variables.

    Returns the rewritten expression and a dict of generated context variables
    mapping variable names to Coding objects. Includes both the full Coding
    (system + code) and a code-only variant for matching QR data that may
    lack a system field.
    """
    extra_context: dict[str, Any] = {}
    counter = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal counter
        system = match.group(1)
        code = match.group(2)
        var_name = f"_coding_{counter}"
        counter += 1
        # Provide code-only Coding so ~ equivalence works even when QR
        # valueCoding lacks a system field (common with form-filler output)
        extra_context[var_name] = {"code": code}
        return f"%{var_name}"

    rewritten = FACTORY_CODING_PATTERN.sub(replacer, expression)
    return rewritten, extra_context


def evaluate(resource: dict[str, Any], path: str) -> list[Any]:
    """Evaluate a FHIRPath expression against a FHIR resource."""
    path, extra = _rewrite_factory_calls(path)
    context: dict[str, Any] = {"resource": resource, **extra}
    try:
        return fhirpathpy.evaluate(resource, path, context, R4_MODEL, _EVAL_OPTIONS)
    except Exception:
        return []


def evaluate_single(resource: dict[str, Any], path: str) -> Any | None:
    """Evaluate a FHIRPath expression and return the first result or None."""
    results = evaluate(resource, path)
    return results[0] if results else None


def combine_expression(base: str, expression: str) -> str:
    """Replace %context in expression with the resolved base path."""
    if "%context" not in expression:
        return expression
    return expression.replace("%context", base)


def get_extension_value(
    extensions: list[dict[str, Any]], url: str
) -> str | None:
    """Get the valueString of an extension by URL."""
    for ext in extensions:
        if ext.get("url") == url:
            return ext.get("valueString")
    return None


def extract_div_content(div: str) -> str:
    """Extract inner content from a div element, removing the outer wrapper."""
    match = re.match(r"<div[^>]*>(.*)</div>", div, re.DOTALL)
    return match.group(1) if match else div


def render_value(value: object) -> str:
    """Convert a FHIRPath result to a display string."""
    if value is None:
        return ""

    if isinstance(value, dict):
        if "display" in value:
            return str(value["display"])
        if "value" in value:
            return str(value["value"])
        if "text" in value:
            return str(value["text"])
        return str(value)

    if isinstance(value, list):
        if not value:
            return ""
        rendered = [render_value(v) for v in value if v is not None]
        non_empty = [r for r in rendered if r]
        return ", ".join(non_empty)

    if isinstance(value, str):
        return value.strip()

    return str(value)


def replace_placeholders(template: str, resource: dict[str, Any], base: str | None) -> str:
    """Replace {{expression}} placeholders with evaluated FHIRPath values."""

    def replacer(match: re.Match[str]) -> str:
        expression = match.group(1).strip()
        if base:
            expression = combine_expression(base, expression)
        result = evaluate_single(resource, expression)
        return html.escape(render_value(result))

    return PLACEHOLDER_PATTERN.sub(replacer, template)


def _render_single(
    section: dict[str, Any],
    resource: dict[str, Any],
    base: str | None,
    depth: int = 2,
) -> str | None:
    """Render one section instance with a resolved base path."""
    section_text = section.get("text", {}).get("div", "")
    rendered = replace_placeholders(section_text, resource, base)
    inner = extract_div_content(rendered)

    # Recursively render child sections
    child_parts = []
    for child in section.get("section", []):
        child_html = _render_section_content(child, resource, parent_base=base, depth=depth + 1)
        if child_html is not None:
            child_parts.append(child_html)

    if child_parts:
        children_html = "\n".join(child_parts)
        if SECTIONS_PLACEHOLDER in inner:
            inner = inner.replace(SECTIONS_PLACEHOLDER, children_html)
        else:
            inner += "\n" + children_html
    elif SECTIONS_PLACEHOLDER in inner:
        inner = inner.replace(SECTIONS_PLACEHOLDER, "")

    # Add heading if title exists
    title = section.get("title", "").strip()
    if title:
        heading_level = min(depth, 6)  # Cap at h6
        inner = f"<h{heading_level}>{html.escape(title)}</h{heading_level}>\n{inner}"

    return inner


def _render_section_content(
    section: dict[str, Any],
    resource: dict[str, Any],
    parent_base: str | None = None,
    depth: int = 2,
) -> str | None:
    """Resolve a section's context and render it.

    When templateExtractContext resolves to N > 1 items, the section is
    rendered N times with an indexed base path.
    """
    extensions = section.get("extension", [])
    context_expr = get_extension_value(extensions, TEMPLATE_EXTRACT_CONTEXT_URL)

    # Compute effective base by combining parent base with this section's context
    if context_expr and parent_base:
        effective_base = combine_expression(parent_base, context_expr)
    elif context_expr:
        effective_base = context_expr
    else:
        effective_base = parent_base

    # Evaluate the effective base to check item count
    if effective_base:
        items = evaluate(resource, effective_base)
        if not items:
            return None
        # Single False means condition not met - skip rendering
        if len(items) == 1 and items[0] is False:
            return None
        if len(items) > 1:
            parts = []
            for i in range(len(items)):
                indexed_base = f"{effective_base}[{i}]"
                part = _render_single(section, resource, indexed_base, depth)
                if part is not None:
                    parts.append(part)
            return "\n".join(parts) if parts else None

    return _render_single(section, resource, effective_base, depth)


def render_section(
    section: dict[str, Any],
    resource: dict[str, Any],
) -> str | None:
    """Render a top-level Composition section, wrapped in <section>."""
    content = _render_section_content(section, resource, depth=2)
    if content is None:
        return None

    section_id = section.get("id", "")
    return (
        f'<section data-section-id="{html.escape(section_id)}">\n'
        f"{content}\n"
        f"</section>"
    )


def render_composition(
    composition_dict: dict[str, Any],
    questionnaire_response: dict[str, Any],
) -> tuple[str, list[str]]:
    """Render a FHIR Composition to HTML using FHIRPath evaluation."""
    errors: list[str] = []

    if composition_dict.get("resourceType") != "Composition":
        errors.append("Resource must be a FHIR Composition")
        return "", errors

    sections_html = [
        section_html
        for section in composition_dict.get("section", [])
        if (section_html := render_section(section, questionnaire_response)) is not None
    ]

    html_output = (
        '<article class="composition">\n'
        f"{''.join(sections_html)}\n"
        "</article>"
    )

    return html_output, errors
