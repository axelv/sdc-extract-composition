"""Generate HTML preview from SDC Questionnaire with Composition template."""

from __future__ import annotations

import os

os.environ.setdefault("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")

import json
import re
import sys
from pathlib import Path
from typing import Any

from fhir_liquid import (
    DesignationResolver,
    combine_expression,
    evaluate_fhirpath_list,
    render_template,
)
from fhir_liquid.designation import ContainedSupplementResolver

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @page {{
            size: A4;
            margin: 0.5cm 2.2cm;
        }}
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.4;
            font-size: 8pt;
        }}
        h1 {{
            font-size: 12pt;
            border-bottom: 1.5px solid #333;
            padding-bottom: 0.3rem;
            margin: 0.5rem 0;
        }}
        h2 {{
            font-size: 9pt;
            margin: 0.8rem 0 0.3rem;
            padding-bottom: 0.2rem;
            border-bottom: 1px solid #ddd;
        }}
        dl {{
            display: grid;
            grid-template-columns: minmax(120px, 1fr) 2fr;
            gap: 0.1rem 0.8rem;
            margin: 0.2rem 0;
        }}
        dt {{
            font-weight: 600;
            padding: 0.1rem 0;
        }}
        dd {{
            margin: 0;
            padding: 0.1rem 0;
            border-bottom: 1px solid #eee;
        }}
        section {{
            margin: 1rem 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 0.5rem 0;
        }}
        th, td {{
            padding: 0.2rem 0.4rem;
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
        header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid #333;
            padding-bottom: 0.4rem;
            margin-bottom: 0.5rem;
        }}
        .lab-info {{
            font-size: 7pt;
            color: #555;
        }}
        .lab-info strong {{
            font-size: 8pt;
            color: #111;
        }}
        .report-meta {{
            font-size: 7pt;
            text-align: right;
            color: #555;
        }}
        .report-meta strong {{
            color: #111;
        }}
        footer {{
            margin-top: 1rem;
            padding-top: 0.4rem;
            border-top: 1.5px solid #333;
        }}
        .attestation {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.8rem;
            font-size: 7pt;
        }}
        .attestation .signer {{
            padding-top: 0.2rem;
        }}
        .attestation .signature-line {{
            margin-top: 1rem;
            border-top: 1px solid #999;
            padding-top: 0.15rem;
            font-size: 6.5pt;
            color: #666;
        }}
        .attestation-note {{
            margin-top: 0.4rem;
            font-size: 6pt;
            color: #888;
            font-style: italic;
        }}
    </style>
</head>
<body>
{header}
    <h1>{title}</h1>
{sections}
{footer}
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


SECTIONS_PLACEHOLDER = "<!-- sections -->"


def _render_single(
    section: dict[str, Any],
    resource: dict[str, Any],
    base: str | None,
    resolver: DesignationResolver | None,
) -> str | None:
    """Render one section instance with a resolved base path.

    Evaluates the section's text.div template, then recursively processes
    child sections and injects their HTML at the <!-- sections --> placeholder.
    """
    section_text = section.get("text", {}).get("div", "")
    context = {"resource": resource}
    if base:
        context["base"] = base

    rendered = render_template(section_text, context, designation_resolver=resolver)
    inner = extract_div_content(rendered)

    # Recursively render child sections
    child_parts = []
    for child in section.get("section", []):
        child_html = _render_section_content(
            child, resource, parent_base=base, resolver=resolver
        )
        if child_html is not None:
            child_parts.append(child_html)

    if child_parts:
        children_html = "\n".join(child_parts)
        if SECTIONS_PLACEHOLDER in inner:
            inner = inner.replace(SECTIONS_PLACEHOLDER, children_html)
        else:
            inner += "\n" + children_html

    return inner


def _render_section_content(
    section: dict[str, Any],
    resource: dict[str, Any],
    parent_base: str | None = None,
    resolver: DesignationResolver | None = None,
) -> str | None:
    """Resolve a section's context and render it, cloning for multi-valued contexts.

    When templateExtractContext resolves to N > 1 items, the section is
    rendered N times with an indexed base path (effective_base[i]).
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
        items = evaluate_fhirpath_list(effective_base, resource)
        if not items:
            return None
        if len(items) > 1:
            # Clone: render once per item with indexed base
            parts = []
            for i in range(len(items)):
                indexed_base = f"{effective_base}[{i}]"
                part = _render_single(section, resource, indexed_base, resolver)
                if part is not None:
                    parts.append(part)
            return "\n".join(parts) if parts else None
    # Single item or no base — render once
    return _render_single(section, resource, effective_base, resolver)


def render_section(
    section: dict[str, Any],
    resource: dict[str, Any],
    resolver: DesignationResolver | None = None,
) -> str | None:
    """Render a top-level Composition section, wrapped in <section><h2>...</h2>."""
    content = _render_section_content(section, resource, resolver=resolver)
    if content is None:
        return None

    section_title = section.get("title", "Untitled")
    return f"""    <section>
        <h2>{section_title}</h2>
        {content}
    </section>"""


def generate_html(
    composition: dict[str, Any],
    resource: dict[str, Any],
    *,
    header_template: str = "",
    footer_template: str = "",
    resolver: DesignationResolver | None = None,
) -> str:
    """Generate HTML from a Composition resource with evaluated FHIRPath expressions."""
    title = composition.get("title", "Composition")

    sections_html = [
        html
        for section in composition.get("section", [])
        if (html := render_section(section, resource, resolver=resolver)) is not None
    ]

    context = {"resource": resource}
    header = (
        render_template(header_template, context, designation_resolver=resolver)
        if header_template
        else ""
    )
    footer = (
        render_template(footer_template, context, designation_resolver=resolver)
        if footer_template
        else ""
    )

    return HTML_TEMPLATE.format(
        title=title,
        sections="\n".join(sections_html),
        header=header,
        footer=footer,
    )


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

    # Build a designation resolver from any contained CodeSystem supplements.
    resolver = ContainedSupplementResolver(questionnaire.get("contained", []))

    # Load optional header/footer templates
    header_path = iteration_path / "header.html"
    footer_path = iteration_path / "footer.html"
    header_template = header_path.read_text() if header_path.exists() else ""
    footer_template = footer_path.read_text() if footer_path.exists() else ""

    # Generate HTML with evaluated expressions
    html = generate_html(
        composition,
        response,
        header_template=header_template,
        footer_template=footer_template,
        resolver=resolver,
    )

    # Write output
    output_dir = iteration_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    html_path = output_dir / "composition-rendered.html"
    html_path.write_text(html)
    print(f"Generated: {html_path}")

    # Generate PDF with weasyprint
    from weasyprint import HTML

    pdf_path = output_dir / "composition-rendered.pdf"
    HTML(string=html).write_pdf(pdf_path)
    print(f"Generated: {pdf_path}")


if __name__ == "__main__":
    main()
