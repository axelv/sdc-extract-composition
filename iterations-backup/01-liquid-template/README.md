# Iteration 01: Liquid Template

## Approach

SDC template-based extraction using FHIR Liquid syntax with FHIRPath expressions in `{{ }}` placeholders.

## Files

- `questionnaire-extract.json` - SDC Questionnaire with contained Composition template
- `questionnaire-response.json` - Example QuestionnaireResponse for testing

## Template Structure

```
Questionnaire
├── contained: [Composition#composition-template]
├── extension: [templateExtract → #composition-template]
└── item: [groups matching response structure]
```

## FHIRPath Expression Pattern

Each section sets a context, then uses Liquid placeholders:

```json
{
  "extension": [{
    "url": "sdc-questionnaire-templateExtractContext",
    "valueString": "%resource.item.where(linkId='preop-an')"
  }],
  "text": {
    "div": "<div>...<dd>{{%context.item.where(linkId='hand').answer.value}}</dd>...</div>"
  }
}
```

## Characteristics

- **Pros**: Clean syntax, familiar Liquid templating, readable narratives
- **Cons**: Long FHIRPath expressions in HTML, no type safety
- **Profile**: `sdc-questionnaire-extr-template`
