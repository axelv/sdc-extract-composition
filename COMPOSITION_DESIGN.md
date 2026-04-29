# Composition Template Design Guide

This document describes the conventions for building FHIR Composition templates that work with the visual editor UI. Following these conventions ensures that templates are editable in the UI and don't fall back to "custom" mode.

## Core Principle: One Section = One Line

**The most important rule**: Each section or subsection represents a complete sentence or line in the output. Never split a sentence across multiple sections.

If a sentence has multiple conditional variations (e.g., different text based on whether a field exists or has a certain value), create multiple conditional sections for the same sentence position, each with the full sentence.

```
WRONG: "The patient" + [if allergies] "has allergies" + [else] "has no allergies"

CORRECT:
- Section (if allergies exist): "The patient has allergies: {{allergies}}"
- Section (if no allergies): "The patient has no known allergies."
```

## Section Context Types

The UI supports three context types that determine when a section renders:

### 1. Always (no context expression)

Renders unconditionally. Use for static content or content that should always appear.

```json
{
  "title": "Patient Information",
  "text": { "div": "<div>...</div>" }
}
```

### 2. Conditional (if)

Renders only when conditions are met. Supports:
- `exists` - field has a value
- `not-exists` - field has no value  
- `equals` - field matches a specific coded value
- `not-equals` - field doesn't match a specific coded value

**UI-parsable format:**
```
%context.where(%context.item.where(linkId='LINK_ID').answer.exists())
%context.where(%context.item.where(linkId='LINK_ID').answer.exists().not())
%context.where(%context.item.where(linkId='LINK_ID').answer.value ~ %factory.Coding('SYSTEM', 'CODE'))
%context.where((%context.item.where(linkId='LINK_ID').answer.value ~ %factory.Coding('SYSTEM', 'CODE')).not())
```

**Multiple conditions (and/or):**

Similar to FHIR Questionnaire `enableWhen` with `enableBehavior`, you must use ALL `and` or ALL `or` - you cannot mix them.

```
%context.where(CONDITION1 and CONDITION2 and CONDITION3)  // ALL conditions must be true
%context.where(CONDITION1 or CONDITION2 or CONDITION3)    // ANY condition must be true
```

**Not supported:** `%context.where(CONDITION1 and CONDITION2 or CONDITION3)` (mixing and/or)

**Example:**
```json
{
  "extension": [{
    "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
    "valueString": "%context.where(%context.item.where(linkId='has-allergies').answer.value ~ %factory.Coding('http://example.org', 'yes'))"
  }],
  "title": "Allergies",
  "text": { "div": "<div>Patient has allergies: {{%context.item.where(linkId='allergy-details').answer.value}}</div>" }
}
```

### 3. Repeating (for-each)

Renders once per item in a repeating group. Use for lists of medications, diagnoses, etc.

**UI-parsable format:**
```
%resource.item.where(linkId='PARENT').item.where(linkId='REPEATING_ITEM')
%context.item.where(linkId='REPEATING_ITEM')
```

**Important:** Use `.item.where(linkId='X')` chain format, NOT `repeat(item).where(linkId='X')`.

**Example:**
```json
{
  "extension": [{
    "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
    "valueString": "%resource.item.where(linkId='medications').item.where(linkId='medication')"
  }],
  "title": "Medication",
  "text": { "div": "<div>{{%context.item.where(linkId='med-name').answer.value}} - {{%context.item.where(linkId='med-dose').answer.value}}</div>" }
}
```

## Variable Expressions

Variables are embedded in content using double curly braces: `{{expression}}`

### Basic Format
```
{{%context.item.where(linkId='LINK_ID').answer.value}}
```

### Scopes

- `%resource` - The entire QuestionnaireResponse (use for root-level or unambiguous items)
- `%context` - Current context (inherits from parent section's context)

**In a repeating section:** `%context` refers to the current iteration item, so use it to access child fields.

**In a conditional section:** `%context` is the filtered result, so child sections should use `%context` to stay within scope.

### Accessing Different Value Types

| Type | Expression | Returns |
|------|------------|---------|
| String/Number | `.answer.value` | The primitive value |
| Coding (full) | `.answer.value` | `{code, system, display}` object |
| Coding display | `.answer.value.display` | Display string |
| Coding code | `.answer.value.code` | Code string |
| Date | `.answer.value` | Date string |
| Boolean | `.answer.value` | `true` or `false` |

### Filters

Filters transform values. Use `||` (double pipe) as separator:

```
{{expression || filter1 || filter2: arg}}
```

**Available filters:**

| Filter | Usage | Description |
|--------|-------|-------------|
| `upcase` | `\|\| upcase` | Convert to uppercase |
| `downcase` | `\|\| downcase` | Convert to lowercase |
| `prepend` | `\|\| prepend: "text"` | Add text before value |
| `append` | `\|\| append: "text"` | Add text after value |
| `default` | `\|\| default: "N/A"` | Fallback if empty |
| `join` | `\|\| join: ", "` | Join list with separator |
| `map` | `\|\| map: "code1" => "text1", "code2" => "text2"` | Map codes to display text |

**Map filter:**
- Works with Coding objects (matches on `.code` property)
- Works with strings (matches case-insensitively)
- Works with lists of either

```
{{%context.item.where(linkId='severity').answer.value || map: "mild" => "Mild symptoms", "severe" => "Severe symptoms"}}
```

## Nesting Sections

Sections can be nested. Child sections inherit the parent's context.

```json
{
  "extension": [{ "valueString": "%resource.item.where(linkId='medication')" }],
  "title": "Medications",
  "section": [
    {
      "text": { "div": "<div>Name: {{%context.item.where(linkId='med-name').answer.value}}</div>" }
    },
    {
      "extension": [{ "valueString": "%context.where(%context.item.where(linkId='med-dose').answer.exists())" }],
      "text": { "div": "<div>Dose: {{%context.item.where(linkId='med-dose').answer.value}}</div>" }
    }
  ]
}
```

**Nesting rules:**
1. Child sections can use `%context` to reference the parent's resolved context
2. A child's conditional expression is evaluated within the parent's context
3. For deeply nested conditions, the UI tracks the effective context from the nearest for-each ancestor

## Building a Complete Composition

### Structure

```json
{
  "resourceType": "Composition",
  "id": "template-composition",
  "status": "preliminary",
  "type": { "text": "Medical Report" },
  "title": "Report Title",
  "section": [
    // Top-level sections here
  ]
}
```

### Workflow for Converting a Narrative Template

1. **Identify the target narrative** - What does the final letter/report look like?

2. **Break into sentences/lines** - Each line becomes a section

3. **Identify conditions** - Which lines are conditional?
   - Does a field need to exist?
   - Does a field need a specific value?
   - Are there multiple variations of the same line?

4. **Identify repetition** - Which parts iterate over lists?
   - Medications, diagnoses, procedures, etc.

5. **Map to questionnaire linkIds** - Find the corresponding questionnaire items

6. **Build sections bottom-up:**
   - Start with innermost repeating groups
   - Add conditional wrappers where needed
   - Build up to top-level sections

### Example: Simple Medical Note

**Target narrative:**
```
Patient: John Doe, DOB: 1990-01-15

Chief Complaint: Headache

Medications:
- Aspirin 500mg
- Ibuprofen 200mg

Allergies: Penicillin (severe reaction)
-- OR --
No known allergies.
```

**Questionnaire structure:**
```
- patient-name (string)
- patient-dob (date)
- chief-complaint (string)
- medications (group, repeats)
  - med-name (string)
  - med-dose (string)
- has-allergies (choice: yes/no)
- allergy-details (string)
```

**Composition:**
```json
{
  "section": [
    {
      "text": { "div": "<div>Patient: {{%resource.item.where(linkId='patient-name').answer.value}}, DOB: {{%resource.item.where(linkId='patient-dob').answer.value}}</div>" }
    },
    {
      "text": { "div": "<div>Chief Complaint: {{%resource.item.where(linkId='chief-complaint').answer.value}}</div>" }
    },
    {
      "title": "Medications",
      "section": [
        {
          "extension": [{
            "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
            "valueString": "%resource.item.where(linkId='medications').item.where(linkId='medication')"
          }],
          "text": { "div": "<div>- {{%context.item.where(linkId='med-name').answer.value}} {{%context.item.where(linkId='med-dose').answer.value}}</div>" }
        }
      ]
    },
    {
      "extension": [{
        "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
        "valueString": "%context.where(%resource.item.where(linkId='has-allergies').answer.value ~ %factory.Coding('http://example.org', 'yes'))"
      }],
      "text": { "div": "<div>Allergies: {{%resource.item.where(linkId='allergy-details').answer.value}}</div>" }
    },
    {
      "extension": [{
        "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
        "valueString": "%context.where((%resource.item.where(linkId='has-allergies').answer.value ~ %factory.Coding('http://example.org', 'yes')).not())"
      }],
      "text": { "div": "<div>No known allergies.</div>" }
    }
  ]
}
```

## UI Compatibility Checklist

Before finalizing a template, verify:

- [ ] Each section is a complete sentence/line (no partial sentences)
- [ ] For-each uses `.item.where(linkId='X')` format (not `repeat(item)`)
- [ ] Conditions use supported operators: `exists`, `not-exists`, `equals`, `not-equals`
- [ ] Conditions reference items via `%context.item.where(linkId='X')` or `%resource.item.where(linkId='X')`
- [ ] Variables use `{{expression}}` format with `||` filter separator
- [ ] Nested sections properly inherit parent context
- [ ] Map filter codes match questionnaire answer option codes exactly

## Extension URLs

The context expression uses this extension URL:
```
http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext
```

Full extension format:
```json
{
  "extension": [{
    "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext",
    "valueString": "CONTEXT_EXPRESSION"
  }]
}
```
