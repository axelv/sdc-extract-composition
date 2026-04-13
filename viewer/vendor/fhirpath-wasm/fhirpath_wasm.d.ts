/** Byte offset range within the original FHIRPath expression string. */
export interface Span {
  start: number;
  end: number;
}

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
}

export interface Diagnostic {
  span: Span;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface AnalysisResult {
  annotations: Annotation[];
  diagnostics: Diagnostic[];
}

/** Parse a FHIRPath expression string into an AST object. */
export function parse(expr: string): object;

/** Annotate a FHIRPath expression, extracting answer/item references and coded values. */
export function annotate_expression(expr: string): Annotation[];

/** Index built from a FHIR Questionnaire, used for expression analysis. */
export class QuestionnaireIndex {
  constructor(questionnaire_json: string);
}

/**
 * Analyze a FHIRPath expression in the context of a Questionnaire.
 *
 * Returns annotations and validation diagnostics.
 */
export function analyze_expression(
  expr: string,
  index: QuestionnaireIndex,
  scope_link_id?: string,
  parent_context_expr?: string,
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
