// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import type { ShaderPackInfo } from "../shared/types";

/**
 * Shaderpacks live in `<runDir>/shaderpacks` - a sibling of `mods/`, not inside it (Minecraft/Iris/
 * Oculus convention, same folder whether or not the launcher manages the instance). Every caller
 * here takes `modsDir` (what the renderer already has on hand from Instance) rather than a
 * dedicated field, and derives the sibling directory itself - the same `path.dirname(modsDir)`
 * "runDir" convention `modConfig.ts`/`launch.ts` already use for the instance's game directory.
 *
 * Unlike mods, a shaderpack isn't individually enabled/disabled by the launcher - Iris/Oculus pick
 * the *one* active pack from this folder via their own in-game Video Settings screen. So this
 * module only manages the folder's contents (list/import/remove); there's no toggle to mirror
 * mods.ts's `.disabled` renaming.
 */
function shaderpacksDir(modsDir: string): string {
  return path.join(path.dirname(modsDir), "shaderpacks");
}

function isPackLike(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".zip");
}

export function listShaderPacks(modsDir: string): ShaderPackInfo[] {
  const dir = shaderpacksDir(modsDir);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && isPackLike(e.name))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        sizeBytes: stat.size,
        importedAt: stat.mtimeMs,
      } satisfies ShaderPackInfo;
    });
}

/** Copies one or more `.zip` shaderpacks the user already has into the instance's shaderpacks folder. */
export function importShaderPacks(modsDir: string, sourcePaths: string[]): ShaderPackInfo[] {
  const dir = shaderpacksDir(modsDir);
  fs.mkdirSync(dir, { recursive: true });
  for (const src of sourcePaths) {
    if (!src.toLowerCase().endsWith(".zip")) continue;
    const dest = path.join(dir, path.basename(src));
    if (path.resolve(src) === path.resolve(dest)) continue;
    fs.copyFileSync(src, dest);
  }
  return listShaderPacks(modsDir);
}

export function removeShaderPack(modsDir: string, fileName: string): ShaderPackInfo[] {
  const dir = shaderpacksDir(modsDir);
  // path.basename strips any directory-traversal segments a malformed fileName might carry -
  // fileName ultimately comes from the renderer over IPC, so it's untrusted input.
  const full = path.join(dir, path.basename(fileName));
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return listShaderPacks(modsDir);
}
