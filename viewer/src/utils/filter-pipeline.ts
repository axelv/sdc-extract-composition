// FHIR Liquid filter pipeline — TypeScript mirror of Python `split_filters`.
//
// A pill expression has the shape:
//     <fhirpath> || filter1: arg, ... || filter2 ...
// We need to read/write the chain so the SynonymsPanel can toggle the
// `designation` filter without disturbing the FHIRPath head or other filters.
//
// Quote-aware splitting matches the Python behaviour exactly so the rendered
// output stays consistent: `||` inside single- or double-quoted regions is
// treated as text, FHIRPath's single `|` union operator is left alone.

export interface FilterInvocation {
  name: string;
  args: FilterLiteral[];
  /** Source slice (without surrounding whitespace) — preserved when the
   *  filter is unmodified so we don't reformat user-authored text. */
  source: string;
}

export type FilterLiteral = string | number | boolean;

export interface ParsedExpression {
  head: string;
  filters: FilterInvocation[];
}

export function parseExpression(inner: string): ParsedExpression {
  const segments = splitTopLevel(inner, "||");
  const head = segments[0].trim();
  const filters = segments.slice(1).map((seg) => parseFilter(seg));
  return { head, filters };
}

/** Format a parsed expression back to a string, preserving the head spacing. */
export function formatExpression(parsed: ParsedExpression): string {
  if (parsed.filters.length === 0) {
    return parsed.head;
  }
  const parts = [parsed.head, ...parsed.filters.map(formatFilter)];
  return parts.join(" || ");
}

export function formatFilter(f: FilterInvocation): string {
  if (f.args.length === 0) return f.name;
  return `${f.name}: ${f.args.map(formatLiteral).join(", ")}`;
}

export function formatLiteral(value: FilterLiteral): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** Find the first `designation` filter and return its `use` argument, or null. */
export function getDesignationUse(parsed: ParsedExpression): string | null {
  const f = parsed.filters.find((x) => x.name === "designation");
  if (!f) return null;
  const arg = f.args[0];
  return typeof arg === "string" ? arg : null;
}

/**
 * Set or replace the `designation` filter's first argument. Returns a new
 * ParsedExpression — does not mutate. Passing `null` removes the filter.
 */
export function setDesignationUse(
  parsed: ParsedExpression,
  use: string | null,
): ParsedExpression {
  const filters = [...parsed.filters];
  const idx = filters.findIndex((f) => f.name === "designation");
  if (use === null) {
    if (idx === -1) return parsed;
    filters.splice(idx, 1);
    return { ...parsed, filters };
  }
  const next: FilterInvocation = {
    name: "designation",
    args: [use],
    source: `designation: ${formatLiteral(use)}`,
  };
  if (idx === -1) {
    filters.push(next);
  } else {
    filters[idx] = next;
  }
  return { ...parsed, filters };
}

// --- internals -------------------------------------------------------------

function splitTopLevel(source: string, sep: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let i = 0;
  let quote: '"' | "'" | null = null;
  const n = source.length;
  const sepLen = sep.length;
  while (i < n) {
    const ch = source[i];
    if (quote !== null) {
      buf += ch;
      if (ch === "\\" && i + 1 < n) {
        buf += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      i += 1;
      continue;
    }
    if (source.startsWith(sep, i)) {
      parts.push(buf);
      buf = "";
      i += sepLen;
      continue;
    }
    buf += ch;
    i += 1;
  }
  parts.push(buf);
  return parts;
}

function parseFilter(segment: string): FilterInvocation {
  const trimmed = segment.trim();
  if (!trimmed) {
    throw new Error("Empty filter segment (stray '||'?)");
  }
  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    return { name: validateName(trimmed), args: [], source: trimmed };
  }
  const name = trimmed.slice(0, colon).trim();
  const argsPart = trimmed.slice(colon + 1);
  const argTokens = splitTopLevel(argsPart, ",");
  const allEmpty = argTokens.every((t) => t.trim() === "");
  const args = allEmpty ? [] : argTokens.map(parseLiteral);
  return { name: validateName(name), args, source: trimmed };
}

function validateName(name: string): string {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Invalid filter name: ${JSON.stringify(name)}`);
  }
  return name;
}

function parseLiteral(token: string): FilterLiteral {
  const t = token.trim();
  if (!t) throw new Error("Empty filter argument");
  if (
    t.length >= 2 &&
    (t[0] === '"' || t[0] === "'") &&
    t[t.length - 1] === t[0]
  ) {
    return unescape(t.slice(1, -1));
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(t) || /^-?\d+[eE][+-]?\d+$/.test(t)) {
    return Number.parseFloat(t);
  }
  throw new Error(`Unsupported filter argument literal: ${JSON.stringify(token)}`);
}

function unescape(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else out += next;
      i += 2;
      continue;
    }
    out += s[i];
    i += 1;
  }
  return out;
}
