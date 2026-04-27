# Composition Editor - Design Document

## Overview

A user-friendly editor for FHIR Composition templates that allows non-technical users to create and edit structured medical documents with conditional/repeating sections and dynamic field placeholders.

## Core Concepts

### Section Context Types

Each section can have a context that controls when/how it renders:

| Type | Color | Icon | Behavior |
|------|-------|------|----------|
| Always | Blue `#6b9fd4` | `—` | Always renders |
| Conditional | Purple `#9b8cc9` | `⎇` | Renders if source exists |
| Repeating | Green `#5fb090` | `↻` | Renders once per item in source |
| Custom | Amber `#d4a85a` | `{}` | Custom FHIRPath expression |

### Pills (Field Placeholders)

- **Standard pills**: Reference questionnaire answers via FHIRPath
  - Blue tones (`#e8f2fc` bg, `#7eb3e0` border, `#2d6aa0` text)
  - Display friendly label, store full expression in `data-expression`
  
- **Custom pills**: Complex/custom FHIRPath expressions
  - Amber tones (`#fef6e0` bg, `#e0b44a` dashed border, `#946b1a` text)
  - Created via `{{expression}}` syntax in editor

### Visual Hierarchy

- Sections indicated by **left border** (3px) colored by context type
- **Floating icon badge** positioned on left border (`left: -11px`)
- Nested sections indented inside parent's `section-children` container
- Tight spacing (2px) between sibling sections

## UI Components

### Section Card

```
┌─────────────────────────────────────┐
│ ○ Title                           × │  ← delete button (top-right, hover)
│   Content with [pills]              │
│   ┌─────────────────────────────┐   │
│   │ ○ Nested section            │   │  ← children area
│   │   ...                       │   │
│   └─────────────────────────────┘   │
│                                     │
│                       + subsection  │  ← add child (bottom-right, hover)
└─────────────────────────────────────┘
                  ⊕                      ← add sibling (centered, hover)
```

### Add Controls

1. **Add sibling** (`+` circle between sections)
   - Appears on hover of adjacent section
   - Centered between sections, z-index above cards
   - SVG icon for perfect centering

2. **Add subsection** (text button)
   - Bottom-right of section
   - Only visible on section hover
   - Extra padding in `section-children` to accommodate

### Hover Behavior (Critical)

Complex hover isolation to prevent parent highlighting when interacting with children:

```css
/* Show buttons on section hover */
.section:hover > .subsection-btn { opacity: 1; }
.section-wrapper:hover + .add-between .plus { opacity: 1; }

/* Hide parent buttons when hovering nested elements */
.section:has(.section-children .section:hover) > .subsection-btn { opacity: 0; }
.section:has(.section-children .add-between:hover) > .subsection-btn { opacity: 0; }
```

### Click Behavior

- Click section → opens editor modal
- Click nested section → opens that section's editor (stopPropagation)
- Click empty area in section-children → opens parent editor
- Click `+` or `subsection` → creates empty section (no auto-open editor)

## Editor Modal

### Structure

1. **Context selector** - 4 buttons (None/Conditional/Repeating/Custom)
2. **Context source** - Dropdown or FHIRPath input based on type
3. **Title input** - Optional, leave empty for no heading
4. **Content editor** - Rich text with formula bar
   - Formula bar shows selected pill's expression
   - Type `/` for autocomplete
   - Type `{{}}` for custom FHIRPath

### Pills in Editor

- `contenteditable="false"` - atomic, can't edit inside
- Zero-width spaces around pills for cursor positioning
- Click pill → select it, show expression in formula bar
- Edit formula bar → updates pill's `data-expression`

## Implementation Notes

### CSS Dependencies

The current implementation has tightly coupled CSS selectors. For cleaner implementation:

1. **Use CSS custom properties for colors**
```css
:root {
  --context-always: #6b9fd4;
  --context-conditional: #9b8cc9;
  --context-repeating: #5fb090;
  --context-custom: #d4a85a;
}
```

2. **Use data attributes instead of classes**
```html
<div class="section" data-context="conditional">
```
```css
.section[data-context="conditional"] { border-left-color: var(--context-conditional); }
```

3. **Isolate hover state with CSS container queries or JS**
   - Current `:has()` selectors work but are complex
   - Consider `onmouseenter`/`onmouseleave` with state management

### React Implementation Suggestions

```tsx
interface Section {
  id: string;
  title?: string;
  content: string; // HTML with pill spans
  context?: {
    type: 'conditional' | 'repeating' | 'custom';
    source: string; // linkId or FHIRPath
  };
  children: Section[];
}

// State management
const [sections, setSections] = useState<Section[]>([]);
const [hoveredId, setHoveredId] = useState<string | null>(null);
const [editingId, setEditingId] = useState<string | null>(null);

// Hover isolation - track which section is directly hovered
// Hide parent controls when child is hovered
const isDirectlyHovered = (id: string) => hoveredId === id;
const hasHoveredChild = (section: Section) => 
  section.children.some(c => c.id === hoveredId || hasHoveredChild(c));
```

### Key Caveats

1. **Pill cursor navigation**: Zero-width spaces needed around `contenteditable="false"` elements
2. **Min-height required**: Sections need min-height (~52px) to prevent button overlap
3. **Section-children padding**: Extra bottom padding (28px) needed for subsection button
4. **Border hover**: Must explicitly set `border-top/right/bottom-color` on hover to preserve left border
5. **Stop propagation carefully**: Sections need `stopPropagation()` but section-children empty area should still trigger parent editor

### Integration with Existing Viewer

The existing `SectionView.tsx` already has:
- Context expression handling (`getContextExpression`)
- Pill rendering (`injectPills`, `NarrativeHtml`)
- Modal integration (`NarrativeEditorModal`)

To add editor functionality:
1. Make sections clickable when `editable` prop is true
2. Add hover state management for add buttons
3. Integrate the new add controls (sibling/subsection)
4. Update context badge to be clickable for editing

## File References

- **Mockup**: `mockups/01-sections-only.html` - Complete working prototype
- **Experiments**: `mockups/experiment-*.html` - Design explorations
- **Existing viewer**: `viewer/src/components/SectionView.tsx`
- **Editor modal**: `viewer/src/components/lexical/NarrativeEditorModal.tsx`

## Next Steps

1. Extract color palette to CSS variables or Tailwind config
2. Create React components matching mockup structure
3. Add hover state management (simpler than CSS `:has()`)
4. Integrate with existing `SectionView` component
5. Connect add/delete operations to composition state
6. Test with real questionnaire data for autocomplete
