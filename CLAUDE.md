# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

SDC (Structured Data Capture) template-based extraction for transforming FHIR QuestionnaireResponses into Composition resources. Uses FHIR Liquid syntax with FHIRPath expressions embedded in `{{ }}` placeholders.

## Commands

```bash
# Generate HTML preview (default iteration)
python src/generate_html.py

# Generate preview for specific iteration
python src/generate_html.py 01-liquid-template

# Install dependencies (uses uv)
uv sync
```

## Architecture

### Core Components

**`src/fhir_liquid/__init__.py`** - FHIRPath expression evaluation within Liquid-style templates
- `render_template(template, context)` - Main entry point; replaces `{{ expression }}` placeholders with evaluated FHIRPath results
- `evaluate_fhirpath(expression, resource, base)` - Evaluates FHIRPath against FHIR resource with optional base context
- Uses `%context` and `%resource` as FHIRPath variables (matching SDC spec)

**`src/generate_html.py`** - Orchestrates extraction and HTML generation
- Loads Questionnaire with contained Composition template
- Loads QuestionnaireResponse data
- Renders each Composition section by evaluating FHIRPath expressions against response data

### Data Flow

```
Questionnaire (with contained Composition template)
    ↓
QuestionnaireResponse (form data)
    ↓
render_template() evaluates {{ FHIRPath }} expressions
    ↓
HTML output with populated values
```

### Iteration Structure

Each extraction approach lives in `iterations/<name>/`:
- `questionnaire-extract.json` - SDC Questionnaire with contained Composition template
- `questionnaire-response.json` - Example QuestionnaireResponse for testing
- `output/` - Generated files (gitignored)

### SDC Extensions Used

- `sdc-questionnaire-templateExtract` - References contained template resource
- `sdc-questionnaire-templateExtractContext` - Sets FHIRPath base context (e.g., `%resource.item.where(linkId='preop-an')`)
- `sdc-questionnaire-templateExtractValue` - Extracts values using FHIRPath

## Dependencies

- `fhirpathpy` - FHIRPath evaluation engine (uses R4 model for type resolution)
- `python-liquid2` - Reserved for future Liquid control flow support
