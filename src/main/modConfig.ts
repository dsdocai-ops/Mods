// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
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
  // modId isn't just a UI-typed string - it's read straight out of an imported mod jar's own
  // manifest (fabric.mod.json's "id" / mods.toml's "modId", see modMetadata.ts) with no format
  // validation there. A crafted jar could declare an id containing "../" segments; path.basename
  // strips those before they ever reach path.join, the same guard mods.ts/shaders.ts already apply
  // to renderer-supplied file names for the same reason.
  const safeModId = path.basename(modId);
  if (!safeModId || safeModId === "unknown") return null;
  const configDir = path.join(runDir, "config");
  if (!fs.existsSync(configDir)) return null;

  for (const fileName of candidateFileNames(safeModId)) {
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

/**
 * Field-for-field mirror of the companion mod's ModConfig.java defaults (both loaders share the
 * same file name and shape). Licensing needs a file to write a redeemed cosmetic into before the
 * mod's first run has created one - and since Gson keeps Java-side defaults for any field a JSON
 * omits, writing the full default set here is always safe.
 */
const OMEGA_CONFIG_DEFAULTS: Record<string, unknown> = {
  fullbrightEnabled: false,
  blockHighlightEnabled: false,
  highlightedBlocks: ["minecraft:obsidian", "minecraft:respawn_anchor", "minecraft:crying_obsidian"],
  highlightColorArgb: "#803B9CFF",
  customFovEnabled: false,
  customFov: 90,
  zoomFov: 30,
  toggleSprintEnabled: false,
  hudEnabled: true,
  hudShowCoords: true,
  hudShowFps: true,
  hudShowKeystrokes: true,
  hudShowPing: true,
  hudShowDirection: true,
  hudShowCps: false,
  noHurtCamEnabled: false,
  noFogEnabled: false,
  clearWeatherEnabled: false,
  schematicPreviewEnabled: false,
  showOmegaUsersEnabled: true,
  ownedCosmeticId: "",
  particlesMasterEnabled: true,
  blockParticlesEnabled: true,
  ambientParticlesEnabled: true,
  totemParticlesEnabled: true,
  critParticlesEnabled: true,
  explosionParticlesEnabled: true,
  portalParticlesEnabled: true,
  particleBlacklist: [],
  particleDensity: 1.0,
};

/** Returns the path to the instance's Omega mod config, creating it with defaults if it doesn't exist yet. */
export function ensureOmegaConfig(runDir: string): string {
  const configDir = path.join(runDir, "config");
  fs.mkdirSync(configDir, { recursive: true });
  const filePath = path.join(configDir, "omega-client.json");
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(OMEGA_CONFIG_DEFAULTS, null, 2), "utf-8");
  }
  return filePath;
}
