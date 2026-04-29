/**
 * UTF-16 code-unit offset range within the original FHIRPath expression string.
 *
 * Indices are aligned with JavaScript string semantics, so they can be passed
 * directly to `String.prototype.slice`, `substring`, or CodeMirror / Monaco
 * position APIs without further translation.
 */
export interface Span {
  start: number;
  end: number;
}

/**
 * Inferred result type of a FHIRPath expression.
 *
 * `unknown` means the analyzer could not determine the type with confidence —
 * UI hosts should treat it as "no information" rather than "any type".
 */
export type InferredType =
  | "boolean"
  | "string"
  | "integer"
  | "decimal"
  | "date"
  | "date_time"
  | "time"
  | "quantity"
  | "coding"
  | "unknown";

/**
 * Inferred cardinality of a FHIRPath expression's result.
 *
 * `unknown` means the analyzer could not determine the cardinality with
 * confidence.
 */
export type Cardinality = "singleton" | "collection" | "unknown";

/**
 * How precisely an annotation attributes to its linkId scope.
 *
 * Omitted on the wire when `full` (the precise default) — only present when
 * a positional selector or scope-widening / opaque op has degraded precision.
 */
export type Attribution =
  | "full"
  | "partial_positional"
  | "widened_scope"
  | "unattributable";

export type AnnotationKind =
  | {
      type: "answer_reference";
      link_ids: string[];
      accessor: "value" | "code" | "display";
    }
  | { type: "item_reference"; link_ids: string[] }
  | {
      type: "coded_value";
      code: string;
      system?: string;
      context_link_id: string;
    };

export interface Annotation {
  span: Span;
  kind: AnnotationKind;
  /** Present only when not `"full"`. */
  attribution?: Attribution;
}

export type DiagnosticCode =
  | "unknown_link_id"
  | "unreachable_link_id"
  | "invalid_accessor_for_type"
  | "missing_accessor_for_coding"
  | "item_reference_targets_leaf"
  | "context_unreachable_from_parent"
  | "expression_not_attributable"
  | "expression_type_mismatch"
  | "expression_cardinality_mismatch";

export interface Diagnostic {
  span: Span;
  severity: "error" | "warning" | "info";
  code: DiagnosticCode;
  message: string;
}

export interface AnalysisResult {
  annotations: Annotation[];
  diagnostics: Diagnostic[];
  /**
   * Inferred result type of the expression. Always populated; `"unknown"`
   * when inference can't determine the type with confidence.
   */
  inferred_type: InferredType;
  /**
   * Inferred cardinality of the expression's result. Always populated;
   * `"unknown"` when inference can't determine the cardinality with confidence.
   */
  inferred_cardinality: Cardinality;
}

/** Parse a FHIRPath expression string into an AST object. */
export function parse(expr: string): object;

/** Annotate a FHIRPath expression, extracting answer/item references and coded values. */
export function annotate_expression(expr: string): Annotation[];

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
  link_id: string;
  item_type: string;
  /**
   * `true` if any item on the path from the Questionnaire root down to and
   * including the target item has `repeats: true`. UI hosts can use this to
   * warn that the chain may collapse multiple instances into a single list.
   */
  traverses_repeating: boolean;
}

/** Index built from a FHIR Questionnaire, used for expression analysis. */
export class QuestionnaireIndex {
  constructor(questionnaire_json: string);
  generate_completions(context_expr: string): CompletionItem[];
}

/**
 * Resolve `%context` references in a FHIRPath expression at the AST level.
 *
 * Parses both expressions, replaces every `%context` reference in `expr` with
 * the parsed `base_expr` AST, and returns the serialized result. Returns
 * `expr` unchanged when no `%context` reference exists.
 */
export function resolve_context(expr: string, base_expr: string): string;

/**
 * Analyze a FHIRPath expression in the context of a Questionnaire.
 *
 * Returns annotations, validation diagnostics, and the inferred result type
 * and cardinality. The inferred fields are filled unconditionally and are
 * suitable for UI metadata (hover, badges).
 *
 * `expected_result_type` and `expected_cardinality` are validation hints —
 * when set, the analyzer emits `expression_type_mismatch` /
 * `expression_cardinality_mismatch` on a definite mismatch. `"unknown"`
 * inference results are silent.
 */
export function analyze_expression(
  expr: string,
  index: QuestionnaireIndex,
  scope_link_id?: string,
  parent_context_expr?: string,
  expected_result_type?: InferredType,
  expected_cardinality?: Cardinality,
): AnalysisResult;

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
}

/**
 * Initialize the WASM module. Must be called before any other function.
 */
export default function init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
