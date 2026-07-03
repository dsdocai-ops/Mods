/**
 * Minimal TOML subset parser/serializer covering what Forge-style mod config files actually use:
 * top-level `key = value` pairs, one level of `[section]` / `[section.sub]` headers, and primitive
 * or flat-array values. Not a spec-complete TOML implementation - multi-line arrays, inline tables,
 * and dates aren't supported. Comments are read but NOT preserved on write; saving a config through
 * the editor regenerates the file from parsed data, so hand-written comments will be lost.
 *
 * Known edge cases where a real TOML value survives parse but comes back different after any
 * save-through-the-editor (found during an adversarial audit pass, deliberately not "fixed" - see
 * why below):
 *  - A whole-number float (`x = 1.0`) round-trips as an integer (`x = 1`) - TomlValue collapses
 *    both to a plain JS `number` with no way to remember "this one had a decimal point", and fixing
 *    that properly would mean either a type users of this module (modConfig.ts, the renderer's
 *    generic number-input form editor) don't currently have to think about, or a lossy
 *    string-based representation that breaks that same number input. Low real-world impact:
 *    Forge/NightConfig coerces either token shape to the field's actual `double`/`float` type on
 *    read, so this only shows up as a type change to something diffing the raw file, not a value
 *    that misbehaves in-game.
 *  - A quoted key (`"weird key" = 5`, valid TOML) doesn't match this parser's bare-key-only regex
 *    and is silently dropped - on save, that setting disappears from the file entirely.
 *  - Integers beyond Number.MAX_SAFE_INTEGER (e.g. a 64-bit seed) lose precision through the
 *    JS-number round-trip.
 *  - A malformed unterminated quoted string is misparsed rather than rejected outright (no crash,
 *    just wrong data - e.g. a stray trailing backslash before the closing quote survives into the
 *    parsed value instead of erroring).
 */

export type TomlValue = string | number | boolean | TomlValue[];
export type TomlTable = { [key: string]: TomlValue | TomlTable };

function parseScalar(raw: string): TomlValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return splitTopLevel(inner).map((item) => parseScalar(item.trim()));
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    // TOML basic strings support backslash escapes; \" and \\ are the two that matter for
    // round-tripping what stringifyToml writes.
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1");
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
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      node = existing as TomlTable;
    } else {
      const created: TomlTable = {};
      node[segment] = created;
      node = created;
    }
  }
  return node;
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

    const kvMatch = /^([A-Za-z0-9_.\-]+)\s*=\s*(.+)$/.exec(line);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const valueRaw = stripInlineComment(kvMatch[2]).trim();
      current[key] = parseScalar(valueRaw);
    }
  }

  return root;
}

function serializeScalar(value: TomlValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(serializeScalar).join(", ")}]`;
  // Backslashes first, then quotes - the other order would double-escape the backslash that the
  // quote replacement just inserted. Without the backslash escape at all, a value containing "\"
  // (Windows paths!) wrote invalid TOML that then round-tripped wrong.
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isTable(value: TomlValue | TomlTable): value is TomlTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeSection(table: TomlTable, path: string[], out: string[]): void {
  const scalarKeys = Object.keys(table).filter((k) => !isTable(table[k]));
  const tableKeys = Object.keys(table).filter((k) => isTable(table[k]));

  if (path.length > 0 && (scalarKeys.length > 0 || tableKeys.length === 0)) {
    out.push(`[${path.join(".")}]`);
  }
  for (const key of scalarKeys) {
    out.push(`${key} = ${serializeScalar(table[key] as TomlValue)}`);
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
