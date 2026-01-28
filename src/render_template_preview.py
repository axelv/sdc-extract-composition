"""Render Composition template as HTML preview with highlighted FHIRPath expressions."""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, BaseLoader


TEMPLATE_EXTRACT_CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext"
)
TEMPLATE_EXTRACT_VALUE_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue"
)


@dataclass
class SectionData:
    """Prepared section data for template rendering."""

    title: str
    context_expr: str | None
    html_content: str
    children: list[SectionData]


JINJA_TEMPLATE = """{% macro render_section(section, depth) %}
<div class="section depth-{{ depth }}">
    <div class="section-header">
        {% if depth == 0 %}
        <h2 class="section-title">{{ section.title }}</h2>
        {% elif depth == 1 %}
        <h3 class="section-title">{{ section.title }}</h3>
        {% else %}
        <h4 class="section-title">{{ section.title }}</h4>
        {% endif %}
        {% if section.context_expr %}
        <code class="context-expr">{{ section.context_expr }}</code>
        {% endif %}
    </div>
    {% if section.html_content %}
    <div class="section-content">
        {{ section.html_content | safe }}
    </div>
    {% endif %}
    {% for child in section.children %}
    {{ render_section(child, depth + 1) }}
    {% endfor %}
</div>
{% endmacro %}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - Template Preview</title>
    <style>
        :root {
            --bg-code: #f4f4f5;
            --border-code: #d4d4d8;
            --text-code: #3f3f46;
            --bg-expr: #fef3c7;
            --border-expr: #f59e0b;
            --text-expr: #92400e;
        }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 900px;
            margin: 2rem auto;
            padding: 0 1rem;
            line-height: 1.6;
            color: #1f2937;
        }
        h1 {
            border-bottom: 2px solid #333;
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
        }
        .composition-meta {
            background: var(--bg-code);
            border: 1px solid var(--border-code);
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 2rem;
        }
        .composition-meta h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
            color: #6b7280;
        }
        .composition-meta code {
            background: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.875rem;
        }
        .section {
            margin-bottom: 1.5rem;
            border-left: 3px solid #e5e7eb;
            padding-left: 1rem;
        }
        .section.depth-0 { border-left-color: #3b82f6; }
        .section.depth-1 { border-left-color: #8b5cf6; }
        .section.depth-2 { border-left-color: #ec4899; }
        .section-header {
            margin-bottom: 0.75rem;
        }
        .section-title {
            margin: 0 0 0.25rem 0;
            color: #111827;
        }
        .context-expr {
            display: inline-block;
            background: var(--bg-code);
            border: 1px solid var(--border-code);
            color: var(--text-code);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-family: ui-monospace, monospace;
        }
        .section-content {
            background: #fafafa;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 1rem;
        }
        .section-content dl {
            display: grid;
            grid-template-columns: minmax(180px, 1fr) 2fr;
            gap: 0.25rem 1rem;
            margin: 0;
        }
        .section-content dt {
            font-weight: 600;
            padding: 0.25rem 0;
        }
        .section-content dd {
            margin: 0;
            padding: 0.25rem 0;
            border-bottom: 1px solid #eee;
        }
        .section-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.5rem 0;
        }
        .section-content th, .section-content td {
            padding: 0.5rem;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .section-content th {
            background: #f5f5f5;
            font-weight: 600;
        }
        .fhirpath-expr {
            background: var(--bg-expr);
            border: 1px solid var(--border-expr);
            color: var(--text-expr);
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-family: ui-monospace, monospace;
            font-size: 0.8em;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <h1>{{ title }}</h1>
    {% if date_expr %}
    <div class="composition-meta">
        <h2>Composition.date</h2>
        <code class="fhirpath-expr">{{ date_expr }}</code>
    </div>
    {% endif %}
    {% for section in sections %}
    {{ render_section(section, 0) }}
    {% endfor %}
</body>
</html>
"""


def load_json(path: Path) -> dict[str, Any]:
    """Load a JSON file."""
    with open(path) as f:
        return json.load(f)


def load_composition(questionnaire: dict[str, Any]) -> dict[str, Any]:
    """Load Composition from Questionnaire contained resources."""
    for contained in questionnaire.get("contained", []):
        if contained.get("resourceType") == "Composition":
            return contained
    raise ValueError("No Composition found in Questionnaire.contained")


def get_extension_value(extensions: list[dict[str, Any]], url: str) -> str | None:
    """Get the value of an extension by URL."""
    for ext in extensions:
        if ext.get("url") == url:
            return ext.get("valueString")
    return None


def highlight_fhirpath_expressions(content: str) -> str:
    """Replace {{ expr }} with <code class="fhirpath-expr">expr</code>."""

    def replace_expr(match: re.Match[str]) -> str:
        expr = match.group(1).strip()
        escaped_expr = html.escape(expr)
        return f'<code class="fhirpath-expr">{escaped_expr}</code>'

    return re.sub(r"\{\{(.+?)\}\}", replace_expr, content)


def extract_div_content(div: str) -> str:
    """Extract inner content from a div element, removing the outer div tags."""
    match = re.match(r"<div[^>]*>(.*)</div>", div, re.DOTALL)
    return match.group(1) if match else div


def prepare_section_data(section: dict[str, Any]) -> SectionData:
    """Recursively prepare section data for template rendering."""
    title = section.get("title", "Untitled")
    extensions = section.get("extension", [])
    context_expr = get_extension_value(extensions, TEMPLATE_EXTRACT_CONTEXT_URL)

    div = section.get("text", {}).get("div", "")
    inner_content = extract_div_content(div)
    html_content = highlight_fhirpath_expressions(inner_content)

    children = [
        prepare_section_data(child) for child in section.get("section", [])
    ]

    return SectionData(
        title=title,
        context_expr=context_expr,
        html_content=html_content,
        children=children,
    )


def get_date_extract_value(composition: dict[str, Any]) -> str | None:
    """Get the templateExtractValue from _date extension."""
    date_element = composition.get("_date", {})
    extensions = date_element.get("extension", [])
    value = get_extension_value(extensions, TEMPLATE_EXTRACT_VALUE_URL)
    if value:
        match = re.match(r"\{\{(.+?)\}\}", value)
        return match.group(1).strip() if match else value
    return None


def render_template_preview(composition: dict[str, Any]) -> str:
    """Render Composition template as HTML preview."""
    title = composition.get("title", "Composition Template")
    date_expr = get_date_extract_value(composition)

    sections = [
        prepare_section_data(section)
        for section in composition.get("section", [])
    ]

    env = Environment(loader=BaseLoader())
    template = env.from_string(JINJA_TEMPLATE)

    return template.render(
        title=title,
        date_expr=date_expr,
        sections=sections,
    )


def main() -> None:
    project_root = Path(__file__).parent.parent

    if len(sys.argv) > 1:
        iteration = sys.argv[1]
    else:
        iteration = "01-liquid-template"

    iteration_path = project_root / "iterations" / iteration
    questionnaire_path = iteration_path / "questionnaire-extract.json"

    if not questionnaire_path.exists():
        print(f"Error: {questionnaire_path} not found")
        sys.exit(1)

    questionnaire = load_json(questionnaire_path)
    composition = load_composition(questionnaire)

    html_output = render_template_preview(composition)

    output_path = iteration_path / "output" / "template-preview.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_output)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
