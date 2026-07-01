import fs from "node:fs";
import path from "node:path";
import type { ConfigFormat, ModConfigFile } from "../shared/types";
import { parseToml, stringifyToml, type TomlTable } from "./toml";

function candidateFileNames(modId: string): string[] {
  return [
    `${modId}.toml`,
    `${modId}-common.toml`,
    `${modId}-client.toml`,
    `${modId}-server.toml`,
    `${modId}.json`,
    `${modId}.json5`,
  ];
}

/** Looks for a config file matching a mod's internal id under `<runDir>/config`, the conventional location for both Forge and most Fabric mods. */
export function findModConfigPath(runDir: string, modId: string): string | null {
  if (!modId || modId === "unknown") return null;
  const configDir = path.join(runDir, "config");
  if (!fs.existsSync(configDir)) return null;

  for (const fileName of candidateFileNames(modId)) {
    const candidate = path.join(configDir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Best-effort JSON5 support (comments + trailing commas) for the handful of Fabric mods that use it - not a full JSON5 parser. */
function stripJson5Extras(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

export function readModConfigFile(filePath: string): ModConfigFile {
  const ext = path.extname(filePath).toLowerCase();
  const text = fs.readFileSync(filePath, "utf-8");

  if (ext === ".toml") {
    return { path: filePath, format: "toml", data: parseToml(text) };
  }
  const data = JSON.parse(stripJson5Extras(text));
  return { path: filePath, format: "json", data };
}

export function writeModConfigFile(filePath: string, format: ConfigFormat, data: Record<string, unknown>): void {
  const content = format === "toml" ? stringifyToml(data as TomlTable) : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, "utf-8");
}
