// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { mavenNameToPath, rulesAllow, safeLibraryPath, type LibraryEntry, type ResolvedVersion } from "./versionResolver";

export interface InstallVerifyResult {
  /** False if launching would crash outright (missing client jar or a required library). */
  ok: boolean;
  missingClientJar: boolean;
  /** Maven names of required libraries not found on disk - empty when ok. */
  missingLibraries: string[];
  /** Missing assets never block a launch (Minecraft runs with broken textures/sounds rather than crashing) - informational only. */
  missingAssetIndex: boolean;
  assetIndexCorrupt: boolean;
  missingAssetObjectCount: number;
}

/** Same "skip natives-only, rule-filtered" logic launch.ts's buildClasspath applies when actually building the classpath - kept in sync deliberately, not shared, since one is a pure check and the other builds real paths. */
function requiredLibraryPaths(gameDir: string, libraries: LibraryEntry[]): Array<{ name: string; fullPath: string }> {
  const out: Array<{ name: string; fullPath: string }> = [];
  for (const lib of libraries) {
    if (!rulesAllow(lib.rules, {})) continue;
    if (lib.natives && !lib.downloads?.artifact) continue;
    const relPath = safeLibraryPath(lib.downloads?.artifact?.path ?? mavenNameToPath(lib.name));
    out.push({ name: lib.name, fullPath: path.join(gameDir, "libraries", relPath) });
  }
  return out;
}

/**
 * Checks an already-resolved version's required files against what's actually on disk, so a
 * broken/partial install fails with one clear message instead of a cryptic Java crash (missing
 * library -> NoClassDefFoundError) or silently-wrong rendering (missing asset objects). Pure
 * filesystem reads, no network - meant to run right before every launch, not just after Install.
 */
export function verifyInstall(gameDir: string, resolved: ResolvedVersion, clientJar: string | null): InstallVerifyResult {
  const missingLibraries = requiredLibraryPaths(gameDir, resolved.libraries)
    .filter(({ fullPath }) => !fs.existsSync(fullPath))
    .map(({ name }) => name);

  const assetIndexPath = path.join(gameDir, "assets", "indexes", `${resolved.assetIndexId}.json`);
  const missingAssetIndex = !fs.existsSync(assetIndexPath);
  let assetIndexCorrupt = false;
  let missingAssetObjectCount = 0;

  if (!missingAssetIndex) {
    try {
      const index = JSON.parse(fs.readFileSync(assetIndexPath, "utf-8"));
      const hashes = new Set(Object.values(index.objects ?? {}).map((o) => (o as { hash: string }).hash));
      for (const hash of hashes) {
        const dest = path.join(gameDir, "assets", "objects", hash.slice(0, 2), hash);
        if (!fs.existsSync(dest)) missingAssetObjectCount++;
      }
    } catch {
      assetIndexCorrupt = true;
    }
  }

  return {
    ok: Boolean(clientJar) && missingLibraries.length === 0,
    missingClientJar: !clientJar,
    missingLibraries,
    missingAssetIndex,
    assetIndexCorrupt,
    missingAssetObjectCount,
  };
}

/** Turns a failing InstallVerifyResult into the one message shown to the user - callers only need to check `.ok` and, if false, throw with this. */
export function describeBlockingIssues(result: InstallVerifyResult): string {
  const parts: string[] = [];
  if (result.missingClientJar) {
    parts.push("the client .jar is missing");
  }
  if (result.missingLibraries.length > 0) {
    const shown = result.missingLibraries.slice(0, 3).join(", ");
    const more = result.missingLibraries.length > 3 ? `, and ${result.missingLibraries.length - 3} more` : "";
    parts.push(`${result.missingLibraries.length} required librar${result.missingLibraries.length === 1 ? "y is" : "ies are"} missing (${shown}${more})`);
  }
  return `This install looks broken: ${parts.join(" and ")}. Re-run Install for this version to repair it.`;
}
