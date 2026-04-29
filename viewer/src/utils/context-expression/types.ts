/**
 * Types for section context configuration.
 *
 * These represent the UI model for context expressions,
 * abstracting away the underlying FHIRPath syntax.
 */

export type ContextMode = "always" | "if" | "for-each" | "custom";

export type ConditionOperator = "exists" | "not-exists" | "equals" | "not-equals";

export type CombineMode = "and" | "or";

export type ConditionScope = "context" | "resource";

export interface CodingValue {
  system: string;
  code: string;
}

export interface Condition {
  linkId: string;
  operator: ConditionOperator;
  scope?: ConditionScope;
  value?: CodingValue;
}

export interface AlwaysConfig {
  mode: "always";
}

export interface IfConfig {
  mode: "if";
  combineMode: CombineMode;
  conditions: Condition[];
}

export interface ForEachConfig {
  mode: "for-each";
  linkId: string;
  scope?: ConditionScope;
}

export interface CustomConfig {
  mode: "custom";
  expression: string;
}

export type ContextConfig = AlwaysConfig | IfConfig | ForEachConfig | CustomConfig;
