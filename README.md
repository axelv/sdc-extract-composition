# SDC Template-Based Extraction for Composition

Transform clinical forms into FHIR Composition resources using SDC (Structured Data Capture) template-based extraction.

## Structure

```
├── iterations/                           # Extraction approach iterations
│   └── 01-liquid-template/
│       ├── questionnaire-extract.json    # SDC Questionnaire with template
│       ├── questionnaire-response.json   # Example response
│       ├── README.md                     # Approach description
│       └── output/                       # Generated previews (gitignored)
├── resources/
│   └── composition-template.json         # Original Composition template (input)
├── examples/
│   └── cts-form-specification.txt        # Original form specification
├── src/
│   └── generate_html.py                  # HTML preview generator
└── docs/                                 # Technical documentation
```

## Iterations

| # | Name | Description |
|---|------|-------------|
| 01 | `liquid-template` | FHIR Liquid syntax with `{{ }}` FHIRPath expressions |

## Usage

Generate HTML preview for an iteration:

```bash
# Default (latest iteration)
python src/generate_html.py

# Specific iteration
python src/generate_html.py 01-liquid-template
```

Output is written to `iterations/<iteration>/output/`.

## Background

### SDC Template Extraction

Uses these SDC extensions:
- `sdc-questionnaire-templateExtract` - Points to contained template resource
- `sdc-questionnaire-templateExtractContext` - Sets FHIRPath context for sections
- `sdc-questionnaire-templateExtractValue` - Extracts values using FHIRPath

### CTS Study Form

Implements the BHSC CTS (Carpal Tunnel Syndrome) study form:
- Preoperative Anamnesis & Clinical/Technical Examination
- Postoperative Anamnesis & Clinical Examination
