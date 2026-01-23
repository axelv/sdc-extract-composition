# FHIR Liquid Templating

## Overview

FHIR uses the Liquid templating language for:
- Building narratives for resources
- Building resources from external data sources (V2, CDA, etc.)

**Source**: [FHIR Liquid Profile](http://hl7.org/fhir/uv/sdc/2025Jan/rendering.html)

## Key Differences from Standard Liquid

FHIR's Liquid profile has important modifications:

1. **Small subset of Liquid** - Uses syntax only, no built-in functions
2. **FHIRPath expressions** - Replaces standard Liquid expressions with FHIRPath
3. **Filter syntax** - Uses `||` instead of `|` for filters (since `|` is a FHIRPath operator)

## Evaluation Context

### Focus Object

Every Liquid template executes with a single focus object:
- When generating a resource, the resource itself is the focus
- In other contexts, the focus must be explicitly specified

### Globals Object

Always available with the following properties:

| Property | Description |
|----------|-------------|
| `date` | The dateTime of execution |
| `path` | Path to the FHIR specification version (e.g., `http://hl7.org/fhir/R4`) |
| `random(N)` | Returns a random number from 0 to N-1 |

## Statements

### Expression Statement

```liquid
{{ expression }}
```

- Whitespace before/after is not significant
- Expression executes in the context of the focus object (may reference other variables)

### Filters

Filters use `||` instead of the standard `|`:

```liquid
{{ expression || filterName }}
```

**Supported filters (minimum)**:
- `markdownify` - Convert markdown to HTML
- `upcase` / `downcase` - Case conversion
- `prepend` - Prepend text to a value

### Additional FHIRPath Functions

| Function | Description |
|----------|-------------|
| `ensureId()` | Returns the element's id, assigns a unique id if none exists (when rendering resources) |

## Control Flow

### Comments

```liquid
{% comment %}
  Anything here is not rendered and Liquid code is not executed.
{% endcomment %}
```

### Conditionals (if/else)

```liquid
{% if expression %}
  Content if true
{% elsif expression %}
  Alternative condition
{% else %}
  Fallback content
{% endif %}
```

- Expression executes in the context of the focus object
- `else` and `elsif` tags are optional

### For Loop

```liquid
{% for var in expression %}
  {{ var.property }}
{% endfor %}
```

- Executes once for each object returned by the expression
- Loop variable is available using the named parameter
- The `forLoop` object is available within the loop

**With else fallback** (for empty collections):

```liquid
{% for var in expression %}
  {{ var.property }}
{% else %}
  The collection is empty.
{% endfor %}
```

### Loop (Deprecated)

The `loop` tag is deprecated in favor of `for`:

```liquid
{% loop var in expression %}
  {{ var.property }}
{% endloop %}
```

### Break

Exit a loop early:

```liquid
{% for var in expression %}
  {{ var.property }}
  {% if expression %}
    {% break %}
  {% endif %}
{% endfor %}
```

### Continue

Skip to next iteration:

```liquid
{% for var in expression %}
  {{ var.property }}
  {% if expression %}
    {% continue %}
  {% endif %}
{% endfor %}
```

### Cycle

Alternate through values within a loop:

```liquid
{% for var in expression %}
  {{ var.property }}
  {% cycle "odd", "even" %}
{% endfor %}
```

### Loop Modifiers

**Limit** - Restrict number of iterations:

```liquid
{% for var in expression limit:2 %}
  {{ var.property }}
{% endfor %}
```

**Offset** - Skip initial iterations:

```liquid
{% for var in expression offset:2 %}
  {{ var.property }}
{% endfor %}
```

**Reversed** - Reverse iteration order:

```liquid
{% for var in expression reversed %}
  {{ var.property }}
{% endfor %}
```

**Note**: Range syntax `(for i in (3..5))` is not supported due to FHIRPath grammar ambiguity.

## Include

Include external templates:

```liquid
{% include filename parameters %}
```

- Filename resolution is implementation-specific
- Parameters are `name=expression` pairs, separated by whitespace
- Parameters are available in included file via the `include` variable

**Example**:

```liquid
{% loop name in Patient.name %}
  {% include humanname.html name=name %}
{% endloop %}
```

In the included file:

```liquid
{{ include.name.family }}
```

## Variables

### Assign

Create or overwrite a variable:

```liquid
{% assign name = expression %}
```

- Expression is a FHIRPath expression
- Name must be a simple token

### Capture

Capture a block of content into a variable:

```liquid
{% capture name %}
  A mix of text and tags
{% endcapture %}
```

## Variable Scope Rules

| Scope | Behavior |
|-------|----------|
| Loop variables | Scoped within the loop |
| Assigned variables | Global to the liquid session |
| Include scope | Global space is seamless across includes |
| Loop variables in includes | Available in nested includes |

**Restrictions**:
- Error to use the same name for a loop variable that's already assigned (runtime error)
- The name `include` cannot be used for a loop variable

## Complete Example

Rendering a patient name list:

```liquid
{% comment %} Render patient names with addresses {% endcomment %}

<h2>Patient Names</h2>

{% for name in Patient.name %}
  <div class="{% cycle 'odd', 'even' %}">
    <strong>{{ name.family || upcase }}</strong>
    {% if name.given %}
      , {{ name.given.first }}
    {% endif %}
  </div>
{% else %}
  <p>No names recorded.</p>
{% endfor %}

{% assign authoredDate = Globals.date %}
<footer>Generated: {{ authoredDate }}</footer>
```

## Relationship to SDC Template Extraction

FHIR Liquid templating is distinct from SDC template-based extraction:

| Aspect | Liquid Templating | SDC Template Extraction |
|--------|-------------------|------------------------|
| **Purpose** | Render narratives, transform data | Extract FHIR resources from QuestionnaireResponse |
| **Syntax** | Liquid tags with FHIRPath | Extensions with FHIRPath |
| **Template location** | External files or inline | Contained resources in Questionnaire |
| **Output** | Text/HTML | FHIR resources |

See [SDC Template-Based Extraction](sdc-template-extraction.md) for extraction-specific documentation.

## References

- [FHIR Liquid Profile Specification](http://hl7.org/fhir/uv/sdc/2025Jan/rendering.html)
- [FHIRPath Specification](http://hl7.org/fhirpath/)
- [Liquid Template Language](https://shopify.github.io/liquid/)
