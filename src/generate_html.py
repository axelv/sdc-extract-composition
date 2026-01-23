"""Generate HTML preview from SDC Questionnaire with Composition template."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from fhir_liquid import render_template

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
            line-height: 1.5;
        }}
        h1 {{
            border-bottom: 2px solid #333;
            padding-bottom: 0.5rem;
        }}
        h2 {{
            background: #f0f0f0;
            padding: 0.5rem;
            margin-top: 2rem;
        }}
        dl {{
            display: grid;
            grid-template-columns: minmax(200px, 1fr) 2fr;
            gap: 0.25rem 1rem;
        }}
        dt {{
            font-weight: 600;
            padding: 0.25rem 0;
        }}
        dd {{
            margin: 0;
            padding: 0.25rem 0;
            border-bottom: 1px solid #eee;
        }}
        section {{
            margin-bottom: 2rem;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }}
        th, td {{
            padding: 0.5rem;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #f5f5f5;
            font-weight: 600;
        }}
        thead th {{
            border-bottom: 2px solid #ccc;
        }}
    </style>
</head>
<body>
    <h1>{title}</h1>
{sections}
</body>
</html>
"""

TEMPLATE_EXTRACT_CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext"
)


def extract_div_content(div: str) -> str:
    """Extract inner content from a div element, removing the outer div tags."""
    match = re.match(r"<div[^>]*>(.*)</div>", div, re.DOTALL)
    return match.group(1) if match else div


def get_extension_value(
    extensions: list[dict[str, Any]], url: str
) -> str | None:
    """Get the value of an extension by URL."""
    for ext in extensions:
        if ext.get("url") == url:
            return ext.get("valueString")
    return None


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


def render_section(
    section: dict[str, Any],
    resource: dict[str, Any],
) -> str:
    """Render a single Composition section with FHIRPath expressions evaluated."""
    section_title = section.get("title", "Untitled")
    section_text = section.get("text", {}).get("div", "")

    # Get the templateExtractContext expression (base path for %context)
    extensions = section.get("extension", [])
    base_path = get_extension_value(extensions, TEMPLATE_EXTRACT_CONTEXT_URL)

    # Create context with base path for proper type resolution
    context = {"resource": resource}
    if base_path:
        context["base"] = base_path

    # Render the template with FHIRPath expressions
    rendered_content = render_template(section_text, context)
    inner_content = extract_div_content(rendered_content)

    return f"""    <section>
        <h2>{section_title}</h2>
        {inner_content}
    </section>"""


def generate_html(
    composition: dict[str, Any],
    resource: dict[str, Any],
) -> str:
    """Generate HTML from a Composition resource with evaluated FHIRPath expressions."""
    title = composition.get("title", "Composition")

    sections_html = [
        render_section(section, resource)
        for section in composition.get("section", [])
    ]

    return HTML_TEMPLATE.format(title=title, sections="\n".join(sections_html))


def main() -> None:
    project_root = Path(__file__).parent.parent

    # Accept iteration folder as argument, default to latest
    if len(sys.argv) > 1:
        iteration = sys.argv[1]
    else:
        iteration = "01-liquid-template"

    iteration_path = project_root / "iterations" / iteration
    questionnaire_path = iteration_path / "questionnaire-extract.json"
    response_path = iteration_path / "questionnaire-response.json"

    if not questionnaire_path.exists():
        print(f"Error: {questionnaire_path} not found")
        sys.exit(1)

    if not response_path.exists():
        print(f"Error: {response_path} not found")
        sys.exit(1)

    # Load resources
    questionnaire = load_json(questionnaire_path)
    response = load_json(response_path)

    # Extract composition template from questionnaire
    composition = load_composition(questionnaire)

    # Generate HTML with evaluated expressions
    html = generate_html(composition, response)

    # Write output
    output_path = iteration_path / "output" / "composition-rendered.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
