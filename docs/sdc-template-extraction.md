# SDC Template-Based Extraction

## Overview

Template-based extraction is a data extraction mechanism in FHIR Structured Data Capture (SDC) that provides a middle ground between definition-based and StructureMap-based approaches.

**Source**: [SDC 2025Jan Ballot - Extraction](https://hl7.org/fhir/uv/sdc/2025Jan/extraction.html)

## Core Concept

The technique uses **template resource(s)** to provide all the "boiler-plate" content for the resource to be extracted. Templates are contained within the Questionnaire itself and annotated with FHIRPath expressions that indicate:

- Which template sections should be populated with QuestionnaireResponse data
- Which parts should be excluded if no data exists

## Key Extensions

### 1. `sdc-questionnaire-templateExtract`

**URL**: `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtract`

Specifies a reference to a contained resource template to be extracted from a questionnaire item once the QuestionnaireResponse is complete.

```json
{
  "extension": [{
    "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtract",
    "extension": [
      {
        "url": "template",
        "valueReference": { "reference": "#compositionTemplate" }
      },
      {
        "url": "fullUrl",
        "valueString": "%CompositionId"
      }
    ]
  }]
}
```

### 2. `sdc-questionnaire-templateExtractBundle`

**URL**: `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractBundle`

Specifies a reference to a contained **transaction bundle** resource template. Use this when extraction produces multiple resources.

**Note**: Incompatible with modular forms.

### 3. `sdc-questionnaire-templateExtractContext`

**URL**: `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext`

Establishes mapping context for replacing template content based on a FHIRPath expression. This is placed **within the template resource** to specify where data comes from.

- Evaluates a FHIRPath expression to determine context for child processing
- If the expression produces no results, the element is removed from the output
- Named properties become available to child extensions

```json
{
  "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
  "valueString": "item.where(linkId = 'patient-name').answer"
}
```

### 4. `sdc-questionnaire-templateExtractValue`

**URL**: `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue`

Provides a FHIRPath expression to evaluate the actual value(s) to replace in the template.

- If expression produces no result, the element is removed
- Can include transformations (e.g., `answer.value * 100`)

```json
{
  "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue",
  "valueString": "answer.value"
}
```

## How It Works

1. **Template Definition**: A resource template (e.g., Composition) is defined in `Questionnaire.contained`
2. **Template Reference**: The `templateExtract` extension on a questionnaire item references the template
3. **Context Mapping**: Within the template, `templateExtractContext` extensions specify which questionnaire items provide data
4. **Value Extraction**: `templateExtractValue` extensions specify the FHIRPath expression to extract the actual value
5. **Extraction Engine**: Scans the template for extensions, evaluates expressions, and replaces placeholder content

## FHIRPath Context Variables

During extraction, the following variables are available:

| Variable | Description |
|----------|-------------|
| `%resource` | The QuestionnaireResponse being extracted |
| `%questionnaire` | The Questionnaire definition |
| `item` | Current item context (when navigating items) |
| `answer` | Current answer context |

## Example: Template with Extraction Annotations

```json
{
  "resourceType": "Composition",
  "id": "compositionTemplate",
  "status": "final",
  "type": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "11488-4",
      "display": "Consultation note"
    }]
  },
  "date": "2024-01-01",
  "_date": {
    "extension": [{
      "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue",
      "valueString": "%resource.authored"
    }]
  },
  "title": "Template Title",
  "_title": {
    "extension": [{
      "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
      "valueString": "item.where(linkId = 'title').answer"
    }, {
      "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue",
      "valueString": "value.ofType(string)"
    }]
  },
  "section": [{
    "title": "Chief Complaint",
    "text": {
      "status": "generated",
      "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">placeholder</div>",
      "_div": {
        "extension": [{
          "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
          "valueString": "item.where(linkId = 'chief-complaint').answer"
        }, {
          "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue",
          "valueString": "'<div xmlns=\"http://www.w3.org/1999/xhtml\">' + value.ofType(string) + '</div>'"
        }]
      }
    }
  }]
}
```

## Advantages

- **No profile knowledge required**: Unlike definition-based extraction
- **More accessible than StructureMap**: No need to learn FHIR Mapping Language
- **Visual template**: The template shows the output structure directly
- **Flexible**: Supports complex resource structures

## Limitations

- Template must be contained in the Questionnaire
- `templateExtractBundle` is incompatible with modular forms
- Requires understanding of FHIRPath

## References

- [SDC Extraction (2025Jan Ballot)](https://hl7.org/fhir/uv/sdc/2025Jan/extraction.html)
- [Example: ExtractComplexTemplate](https://hl7.org/fhir/uv/sdc/2025Jan/Questionnaire-extract-complex-template.html)
- [templateExtractContext Extension](https://hl7.org/fhir/uv/sdc/2025Jan/StructureDefinition-sdc-questionnaire-templateExtractContext.html)
- [templateExtractValue Extension](https://hl7.org/fhir/uv/sdc/2025Jan/StructureDefinition-sdc-questionnaire-templateExtractValue.html)
