import AdmZip from "adm-zip";
import type { Loader, ModTag } from "../shared/types";

export interface ParsedModMetadata {
  /** The mod's own internal id (e.g. "sodium"), used to find its config file - distinct from the display name. */
  modId: string;
  name: string;
  version: string;
  description: string;
  loader: Loader | "unknown";
  tags: ModTag[];
}

const PERF_KEYWORDS = ["sodium", "lithium", "starlight", "phosphor", "lazydfu", "ferrite", "modernfix", "krypton", "immediatelyfast", "entityculling", "c2me", "noisium", "performance", "optimi", "fps", "lag"];
const PVP_KEYWORDS = ["pvp", "hit", "combat", "reach", "crosshair", "cit"];
const VISUAL_KEYWORDS = ["shader", "resource", "texture", "hud", "overlay", "waypoint", "minimap", "chat"];
const LIBRARY_KEYWORDS = ["api", "library", "lib", "fabric-language", "kotlin"];

function guessTags(name: string, description: string): ModTag[] {
  const haystack = `${name} ${description}`.toLowerCase();
  const tags = new Set<ModTag>();
  if (PERF_KEYWORDS.some((k) => haystack.includes(k))) tags.add("performance");
  if (PVP_KEYWORDS.some((k) => haystack.includes(k))) tags.add("pvp");
  if (VISUAL_KEYWORDS.some((k) => haystack.includes(k))) tags.add("visual");
  if (LIBRARY_KEYWORDS.some((k) => haystack.includes(k))) tags.add("library");
  if (tags.size === 0) tags.add("other");
  return [...tags];
}

/** Extracts a handful of fields out of a Forge `mods.toml` [[mods]] block without a full TOML parser. */
function extractTomlField(toml: string, key: string): string | undefined {
  const singleLine = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m").exec(toml);
  if (singleLine) return singleLine[1];
  const tripleQuoted = new RegExp(`^\\s*${key}\\s*=\\s*'''([\\s\\S]*?)'''`, "m").exec(toml);
  if (tripleQuoted) return tripleQuoted[1].trim();
  return undefined;
}

function parseFabricLike(entryData: Buffer, loader: Loader): ParsedModMetadata | null {
  try {
    const json = JSON.parse(entryData.toString("utf-8"));
    const modId: string = json.id || "unknown";
    const name: string = json.name || json.id || "Unknown Mod";
    const version: string = json.version || "unknown";
    const description: string = json.description || "";
    return { modId, name, version, description, loader, tags: guessTags(name, description) };
  } catch {
    return null;
  }
}

function parseModsToml(entryData: Buffer): ParsedModMetadata | null {
  const text = entryData.toString("utf-8");
  const modId = extractTomlField(text, "modId") ?? "unknown";
  const name = extractTomlField(text, "displayName") ?? "Unknown Mod";
  const version = extractTomlField(text, "version") ?? "unknown";
  const description = extractTomlField(text, "description") ?? "";
  return { modId, name, version, description, loader: "forge", tags: guessTags(name, description) };
}

function parseMcmodInfo(entryData: Buffer): ParsedModMetadata | null {
  try {
    const json = JSON.parse(entryData.toString("utf-8"));
    const first = Array.isArray(json) ? json[0] : json.modList?.[0];
    if (!first) return null;
    const modId: string = first.modid || "unknown";
    const name: string = first.name || "Unknown Mod";
    const version: string = first.version || "unknown";
    const description: string = first.description || "";
    return { modId, name, version, description, loader: "forge", tags: guessTags(name, description) };
  } catch {
    return null;
  }
}

/** Reads a mod jar and pulls out display metadata by checking each loader's manifest format in turn. */
export function readModMetadata(jarPath: string, fallbackName: string): ParsedModMetadata {
  try {
    const zip = new AdmZip(jarPath);

    const fabricEntry = zip.getEntry("fabric.mod.json");
    if (fabricEntry) {
      const parsed = parseFabricLike(fabricEntry.getData(), "fabric");
      if (parsed) return parsed;
    }

    const quiltEntry = zip.getEntry("quilt.mod.json");
    if (quiltEntry) {
      try {
        const json = JSON.parse(quiltEntry.getData().toString("utf-8"));
        const meta = json.quilt_loader?.metadata ?? {};
        const modId: string = json.quilt_loader?.id || "unknown";
        const name: string = meta.name || json.quilt_loader?.id || "Unknown Mod";
        const version: string = json.quilt_loader?.version || "unknown";
        const description: string = meta.description || "";
        return { modId, name, version, description, loader: "quilt", tags: guessTags(name, description) };
      } catch {
        // fall through to other formats
      }
    }

    const modsTomlEntry = zip.getEntry("META-INF/mods.toml");
    if (modsTomlEntry) {
      const parsed = parseModsToml(modsTomlEntry.getData());
      if (parsed) return parsed;
    }

    const neoforgeTomlEntry = zip.getEntry("META-INF/neoforge.mods.toml");
    if (neoforgeTomlEntry) {
      const parsed = parseModsToml(neoforgeTomlEntry.getData());
      if (parsed) return { ...parsed, loader: "neoforge" };
    }

    const mcmodEntry = zip.getEntry("mcmod.info");
    if (mcmodEntry) {
      const parsed = parseMcmodInfo(mcmodEntry.getData());
      if (parsed) return parsed;
    }
  } catch {
    // Corrupt/unreadable jar - fall back to filename-derived metadata below.
  }

  return {
    modId: fallbackName.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
    name: fallbackName,
    version: "unknown",
    description: "",
    loader: "unknown",
    tags: guessTags(fallbackName, ""),
  };
}
