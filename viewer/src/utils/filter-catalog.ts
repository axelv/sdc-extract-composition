// Catalog of liquid filters surfaced by the FormattingPanel.
//
// The Python pipeline owns runtime semantics (`src/fhir_liquid/filters.py`).
// This catalog is a UI-side projection: which filters to *offer* per value
// shape and how to render their argument editors. The `designation` filter
// is intentionally absent — it's owned by the SynonymsPanel.
//
// `default` is included even though the Python implementation isn't wired up
// yet: the goal of this iteration is to inspect the panel design.

export type FilterArgKind = "string" | "number";

export interface FilterArgSpec {
  name: string;
  kind: FilterArgKind;
  placeholder?: string;
}

export interface FilterSpec {
  name: string;
  label: string;
  description: string;
  args: FilterArgSpec[];
  /** Value shapes (from inferAnswerShape) this filter is offered for. */
  applicableTo: readonly string[];
}

// Shorthand sets so the catalog stays readable.
const STRINGY = ["string", "text"] as const;
const NUMERIC = ["integer", "decimal"] as const;
const TEMPORAL = ["date", "dateTime", "time"] as const;
const ANY_SCALAR = [
  ...STRINGY,
  ...NUMERIC,
  ...TEMPORAL,
  "boolean",
  "url",
  "Coding",
  "Quantity",
] as const;

export const FILTER_CATALOG: FilterSpec[] = [
  {
    name: "default",
    label: "Default",
    description: "Render this value when the answer is empty.",
    args: [{ name: "fallback", kind: "string", placeholder: "/" }],
    applicableTo: ANY_SCALAR,
  },
  {
    name: "prepend",
    label: "Prefix",
    description: "Add text in front of the rendered value.",
    args: [{ name: "prefix", kind: "string", placeholder: "≈ " }],
    applicableTo: ANY_SCALAR,
  },
  {
    name: "append",
    label: "Suffix",
    description: "Add text after the rendered value.",
    args: [{ name: "suffix", kind: "string", placeholder: " cm" }],
    applicableTo: ANY_SCALAR,
  },
  {
    name: "upcase",
    label: "Upper case",
    description: "Render text in upper case.",
    args: [],
    applicableTo: STRINGY,
  },
  {
    name: "downcase",
    label: "Lower case",
    description: "Render text in lower case.",
    args: [],
    applicableTo: STRINGY,
  },
  {
    name: "join",
    label: "Join",
    description: "Join multiple values with a separator.",
    args: [{ name: "separator", kind: "string", placeholder: ", " }],
    applicableTo: ["list", "Coding", ...STRINGY],
  },
  {
    name: "map",
    label: "Map",
    description: "Map coded answers to custom narrative text.",
    args: [],
    applicableTo: ["Coding"],
  },
];

const CATALOG_BY_NAME: Map<string, FilterSpec> = new Map(
  FILTER_CATALOG.map((f) => [f.name, f]),
);

export function getFilterSpec(name: string): FilterSpec | undefined {
  return CATALOG_BY_NAME.get(name);
}

export function filtersForShape(valueShape: string | null): FilterSpec[] {
  if (!valueShape || valueShape === "unknown" || valueShape === "mixed") {
    return FILTER_CATALOG;
  }
  return FILTER_CATALOG.filter((f) => f.applicableTo.includes(valueShape));
}

/** Filters owned by another panel — never surface them in the formatting list. */
export const HIDDEN_FILTERS: ReadonlySet<string> = new Set(["designation"]);

/** Filters that have a separate config panel below the format row. */
export const PANEL_FILTERS: ReadonlySet<string> = new Set(["map"]);
