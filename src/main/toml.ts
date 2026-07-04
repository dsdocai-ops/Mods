// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
/**
 * Minimal TOML subset parser/serializer covering what Forge-style mod config files actually use:
 * top-level `key = value` pairs, one level of `[section]` / `[section.sub]` headers, quoted or
 * bare keys, and primitive or flat-array values. Not a spec-complete TOML implementation -
 * multi-line arrays, inline tables, and dates aren't supported. Comments are read but NOT
 * preserved on write; saving a config through the editor regenerates the file from parsed data,
 * so hand-written comments will be lost.
 *
 * Numbers that a plain JS `number` can't losslessly round-trip (a whole-number float like `1.0`,
 * which would otherwise come back as the integer `1`; an integer beyond
 * Number.MAX_SAFE_INTEGER, e.g. a 64-bit seed) are represented as TomlNumberLiteral instead,
 * preserving the exact source text through an untouched parse -> stringify cycle. Only actually
 * editing that field through the renderer's number input regenerates its text from a plain JS
 * number (an HTML number input can't hold more precision than that in the first place - editing
 * a 20-digit seed was never going to survive with full precision either way).
 */

export interface TomlNumberLiteral {
  __tomlType: "number";
  raw: string;
}

export type TomlValue = string | number | boolean | TomlNumberLiteral | TomlValue[];
export type TomlTable = { [key: string]: TomlValue | TomlTable };

function isNumberLiteral(value: unknown): value is TomlNumberLiteral {
  return typeof value === "object" && value !== null && (value as { __tomlType?: unknown }).__tomlType === "number";
}

/**
 * Escape-aware check for whether a double-quoted scalar is actually properly closed - a naive
 * `endsWith('"')` is wrong when the apparent closing quote is itself escaped (`"abc\"` is a
 * dangling backslash before end-of-line, not a closed string). Mirrors stripInlineComment's own
 * escape-tracking loop below.
 */
function isProperlyClosedDoubleQuoted(trimmed: string): boolean {
  if (trimmed.length < 2 || !trimmed.startsWith('"')) return false;
  let escaped = false;
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') return i === trimmed.length - 1;
  }
  return false;
}

function parseScalar(raw: string): TomlValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const numberMatch = /^-?\d+(\.\d+)?$/.exec(trimmed);
  if (numberMatch) {
    const isFloat = numberMatch[1] !== undefined;
    const numeric = Number(trimmed);
    if (isFloat || !Number.isSafeInteger(numeric)) {
      return { __tomlType: "number", raw: trimmed };
    }
    return numeric;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return splitTopLevel(inner).map((item) => parseScalar(item.trim()));
  }
  if (trimmed.startsWith('"')) {
    // TOML basic strings support backslash escapes; \" and \\ are the two that matter for
    // round-tripping what stringifyToml writes. A malformed/unterminated string (the closing
    // quote is escaped, or missing outright) falls through unstripped rather than being misparsed
    // into wrong data - degrading gracefully like every other malformed-input case in this file.
    if (isProperlyClosedDoubleQuoted(trimmed)) {
      return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1");
    }
    return trimmed;
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    // TOML literal strings: no escapes by spec.
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let escaped = false;
  let current = "";
  for (const ch of text) {
    if (inQuote) {
      current += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\" && inQuote === '"') {
        escaped = true;
      } else if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts;
}

/** Strips a trailing `# comment`, but only outside of quotes - a naive `split("#")` would truncate any string value that legitimately contains a "#" (hex colors, descriptions with hashtags, etc). */
function stripInlineComment(value: string): string {
  let inQuote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inQuote) {
      // Backslash escapes only exist in double-quoted (basic) strings - an escaped \" must not
      // close the string. Single-quoted (literal) strings have no escapes by spec.
      if (ch === "\\" && inQuote === '"') {
        i++;
        continue;
      }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "#") return value.slice(0, i);
  }
  return value;
}

function getOrCreateSection(root: TomlTable, path: string[]): TomlTable {
  let node = root;
  for (const segment of path) {
    const existing = node[segment];
    if (existing && typeof existing === "object" && !Array.isArray(existing) && !isNumberLiteral(existing)) {
      node = existing as TomlTable;
    } else {
      const created: TomlTable = {};
      node[segment] = created;
      node = created;
    }
  }
  return node;
}

/** Unescapes a double-quoted key's contents the same way parseScalar does for double-quoted string values. */
function unescapeDoubleQuoted(inner: string): string {
  return inner.replace(/\\(["\\])/g, "$1");
}

/** Parses a key at the start of `line` (bare, or double/single-quoted), returning [key, restOfLine] or null if the line doesn't start with a valid key at all. */
function parseKeyPrefix(line: string): { key: string; rest: string } | null {
  const dqMatch = /^"((?:[^"\\]|\\.)*)"\s*=\s*(.+)$/.exec(line);
  if (dqMatch) return { key: unescapeDoubleQuoted(dqMatch[1]), rest: dqMatch[2] };

  const sqMatch = /^'([^']*)'\s*=\s*(.+)$/.exec(line);
  if (sqMatch) return { key: sqMatch[1], rest: sqMatch[2] };

  const bareMatch = /^([A-Za-z0-9_.\-]+)\s*=\s*(.+)$/.exec(line);
  if (bareMatch) return { key: bareMatch[1].trim(), rest: bareMatch[2] };

  return null;
}

export function parseToml(text: string): TomlTable {
  const root: TomlTable = {};
  let current = root;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      current = getOrCreateSection(root, sectionMatch[1].split(".").map((s) => s.trim()));
      continue;
    }

    const kv = parseKeyPrefix(line);
    if (kv) {
      const valueRaw = stripInlineComment(kv.rest).trim();
      current[kv.key] = parseScalar(valueRaw);
    }
  }

  return root;
}

const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** Bare keys are written unquoted; anything else (spaces, punctuation) needs the same quoting/escaping parseKeyPrefix expects to read back. */
function serializeKey(key: string): string {
  if (BARE_KEY_RE.test(key)) return key;
  return `"${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeScalar(value: TomlValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (isNumberLiteral(value)) return value.raw;
  if (Array.isArray(value)) return `[${value.map(serializeScalar).join(", ")}]`;
  // Backslashes first, then quotes - the other order would double-escape the backslash that the
  // quote replacement just inserted. Without the backslash escape at all, a value containing "\"
  // (Windows paths!) wrote invalid TOML that then round-tripped wrong.
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isTable(value: TomlValue | TomlTable): value is TomlTable {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isNumberLiteral(value);
}

function serializeSection(table: TomlTable, path: string[], out: string[]): void {
  const scalarKeys = Object.keys(table).filter((k) => !isTable(table[k]));
  const tableKeys = Object.keys(table).filter((k) => isTable(table[k]));

  if (path.length > 0 && (scalarKeys.length > 0 || tableKeys.length === 0)) {
    out.push(`[${path.map(serializeKey).join(".")}]`);
  }
  for (const key of scalarKeys) {
    out.push(`${serializeKey(key)} = ${serializeScalar(table[key] as TomlValue)}`);
  }
  for (const key of tableKeys) {
    out.push("");
    serializeSection(table[key] as TomlTable, [...path, key], out);
  }
}

export function stringifyToml(data: TomlTable): string {
  const out: string[] = [];
  serializeSection(data, [], out);
  return out.join("\n") + "\n";
}
