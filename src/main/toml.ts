/**
 * Minimal TOML subset parser/serializer covering what Forge-style mod config files actually use:
 * top-level `key = value` pairs, one level of `[section]` / `[section.sub]` headers, and primitive
 * or flat-array values. Not a spec-complete TOML implementation - multi-line arrays, inline tables,
 * and dates aren't supported. Comments are read but NOT preserved on write; saving a config through
 * the editor regenerates the file from parsed data, so hand-written comments will be lost.
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
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let current = "";
  for (const ch of text) {
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
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
  return `"${String(value).replace(/"/g, '\\"')}"`;
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
