/**
 * Context expression module.
 *
 * Provides types and utilities for parsing/formatting section context
 * expressions, abstracting away FHIRPath syntax into a UI-friendly model.
 */

export type {
  ContextConfig,
  ContextMode,
  Condition,
  ConditionOperator,
  ConditionScope,
  CombineMode,
  CodingValue,
  AlwaysConfig,
  IfConfig,
  ForEachConfig,
  CustomConfig,
} from "./types";

export { formatContextExpression } from "./format";
export { parseContextExpression } from "./parse";
