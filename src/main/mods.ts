// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import type { ModInfo, ModTag } from "../shared/types";
import { forgetModMetadata, noteModMetadataRenamed, readModMetadata } from "./modMetadata";

const DISABLED_SUFFIX = ".disabled";

function isJarLike(fileName: string): boolean {
  const stripped = fileName.endsWith(DISABLED_SUFFIX) ? fileName.slice(0, -DISABLED_SUFFIX.length) : fileName;
  return stripped.toLowerCase().endsWith(".jar");
}

function baseIdFor(fileName: string): string {
  return fileName.endsWith(DISABLED_SUFFIX) ? fileName.slice(0, -DISABLED_SUFFIX.length) : fileName;
}

/**
 * Lists every mod jar in a mods directory (enabled and disabled), reading loader
 * metadata straight out of each jar so the launcher reflects mods the user drops
 * in manually too, not just ones imported through the UI.
 */
export function listMods(modsDir: string): ModInfo[] {
  if (!fs.existsSync(modsDir)) return [];

  const entries = fs.readdirSync(modsDir, { withFileTypes: true }).filter((e) => e.isFile() && isJarLike(e.name));

  return entries.map((entry) => {
    const fullPath = path.join(modsDir, entry.name);
    const stat = fs.statSync(fullPath);
    const id = baseIdFor(entry.name);
    const meta = readModMetadata(fullPath, id.replace(/\.jar$/i, ""));
    return {
      id,
      fileName: entry.name,
      modId: meta.modId,
      name: meta.name,
      version: meta.version,
      description: meta.description,
      loader: meta.loader,
      enabled: !entry.name.endsWith(DISABLED_SUFFIX),
      tags: meta.tags,
      sizeBytes: stat.size,
      importedAt: stat.mtimeMs,
    } satisfies ModInfo;
  });
}

/** Copies one or more mod jars the user already has (their own mods) into an instance's mods folder. */
export function importMods(modsDir: string, sourcePaths: string[]): ModInfo[] {
  fs.mkdirSync(modsDir, { recursive: true });
  for (const src of sourcePaths) {
    if (!src.toLowerCase().endsWith(".jar")) continue;
    const dest = path.join(modsDir, path.basename(src));
    if (path.resolve(src) === path.resolve(dest)) continue;
    fs.copyFileSync(src, dest);
  }
  return listMods(modsDir);
}

/** Renames one mod's jar to reflect the desired enabled state, without the cost of a full directory re-scan. */
function renameModFile(modsDir: string, modId: string, enabled: boolean): void {
  // modId is a bare renderer-supplied IPC argument (see mods:setEnabled/mods:remove in main.ts),
  // not constrained at the handler level to values listMods() actually returned - path.basename
  // matches the same guard importMods() above and shaders.ts already apply to file names of this
  // kind, so a value containing "../" segments can't escape modsDir.
  const safeId = path.basename(modId);
  const enabledPath = path.join(modsDir, safeId);
  const disabledPath = path.join(modsDir, safeId + DISABLED_SUFFIX);

  if (enabled && fs.existsSync(disabledPath)) {
    fs.renameSync(disabledPath, enabledPath);
    noteModMetadataRenamed(disabledPath, enabledPath);
  } else if (!enabled && fs.existsSync(enabledPath)) {
    fs.renameSync(enabledPath, disabledPath);
    noteModMetadataRenamed(enabledPath, disabledPath);
  }
}

/** Flips a mod between active (`.jar`) and inactive (`.jar.disabled`) - the toggle behind the UI switch. */
export function setModEnabled(modsDir: string, modId: string, enabled: boolean): ModInfo[] {
  renameModFile(modsDir, modId, enabled);
  return listMods(modsDir);
}

export function removeMod(modsDir: string, modId: string): ModInfo[] {
  const safeId = path.basename(modId); // see renameModFile's comment above for why
  for (const candidate of [safeId, safeId + DISABLED_SUFFIX]) {
    const full = path.join(modsDir, candidate);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      forgetModMetadata(full);
    }
  }
  return listMods(modsDir);
}

/**
 * Applies many enable/disable changes in a single pass. `setModEnabled` in a loop would re-scan
 * and re-parse every jar in the folder once per mod changed - O(n^2) for an n-mod pack - so bulk
 * callers (presets, enable/disable-all) go through here instead: all the renames happen first,
 * and the directory is only re-scanned once at the end.
 */
export function setModsEnabledBulk(modsDir: string, changes: Record<string, boolean>): ModInfo[] {
  for (const [modId, enabled] of Object.entries(changes)) {
    renameModFile(modsDir, modId, enabled);
  }
  return listMods(modsDir);
}

/** Bulk-enable every mod carrying any of the given tags and bulk-disable the rest - powers preset buttons like "Smooth PvP". */
export function applyTagPreset(modsDir: string, tags: ModTag[]): ModInfo[] {
  const mods = listMods(modsDir);
  const changes: Record<string, boolean> = {};
  for (const mod of mods) {
    changes[mod.id] = mod.tags.some((t) => tags.includes(t));
  }
  return setModsEnabledBulk(modsDir, changes);
}
