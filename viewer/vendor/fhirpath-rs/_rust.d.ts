/* tslint:disable */
/* eslint-disable */

/**
 * A Questionnaire index for use in expression analysis.
 *
 * Build one from a FHIR Questionnaire JSON string, then pass it
 * to `analyze_expression` for semantic validation.
 */
export class QuestionnaireIndex {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Generate completion items for autocomplete given a context expression.
     */
    generate_completions(context_expr: string): any;
    /**
     * Build a `QuestionnaireIndex` from a FHIR Questionnaire JSON string.
     */
    constructor(questionnaire_json: string);
}

/**
 * Analyze a FHIRPath expression in the context of a Questionnaire.
 *
 * Returns `{ annotations: Annotation[], diagnostics: Diagnostic[] }`.
 *
 * - `expr` -- the FHIRPath expression string
 * - `index` -- a `QuestionnaireIndex` built from the Questionnaire
 * - `scope_link_id` -- optional linkId of the item scope (for reachability checks)
 * - `parent_context_expr` -- optional parent context expression (raw FHIRPath)
 */
export function analyze_expression(expr: string, index: QuestionnaireIndex, scope_link_id?: string | null, parent_context_expr?: string | null): any;

/**
 * Annotate a FHIRPath expression, extracting answer references,
 * item references, and coded values.
 *
 * Returns `Annotation[]` as a JavaScript value.
 */
export function annotate_expression(expr: string): any;

/**
 * Parse a FHIRPath expression string into an AST.
 *
 * Returns the AST as a JavaScript object.
 */
export function parse(expr: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_questionnaireindex_free: (a: number, b: number) => void;
    readonly analyze_expression: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly annotate_expression: (a: number, b: number) => [number, number, number];
    readonly parse: (a: number, b: number) => [number, number, number];
    readonly questionnaireindex_generate_completions: (a: number, b: number, c: number) => [number, number, number];
    readonly questionnaireindex_new: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
