// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { InstallableVersion } from "../shared/types";
import { fetchWithRetry, listInstallableVersions } from "./installer";

/**
 * The remotely-updateable "versions catalog": which Minecraft versions the Omega companion mod
 * ships a build for, and at what tier. Replacing the old hardcoded OMEGA_MOD_MINECRAFT_VERSIONS
 * list with a manifest published to the rolling release means a new Omega port becomes visible to
 * every already-installed launcher the moment CI publishes it - no launcher update required.
 *
 * Resolution is a fall-through chain, remote-first (freshest wins) but always with a working floor:
 *   1. the manifest on the rolling "latest-build" GitHub Release (persisted to userData on success);
 *   2. that persisted userData cache (last-known-good, for offline / release-down);
 *   3. a copy bundled into the app (packaged: resourcesPath/bundled; dev: the repo-root file);
 *   4. DEFAULT_SUPPORT, a hardcoded floor matching today's shipping 1.20.1 build.
 * Every step swallows its own errors and falls through, so a wrong/corrupt/unreachable remote file
 * can never brick a launch - the worst case is stale support info, never a crash.
 *
 * Lockstep rule (inherited from bundledMods.ts): an entry must only appear in this manifest once the
 * matching jar actually exists on the release. Placing an Omega jar built for a version an instance
 * isn't running is not a soft failure - Fabric/Forge abort the whole launch over a mismatched
 * "minecraft" dependency - so a listed-but-unpublished version would hand a matching instance a jar
 * that 404s (or worse, a wrong one). CI publishing the jars and this manifest from the same run is
 * what enforces the invariant; nothing here should ever get ahead of what the release really carries.
 */

export type OmegaTier = "main" | "bridge";

/**
 * One supported Minecraft version. `tier` is the Omega feature story for it: "main" is the flagship
 * port carrying the full Omega feature set (exactly one version is main), "bridge" is a thin port
 * with the core features only. `loaders` are the loaders a jar was actually published for.
 */
export interface OmegaVersionSupport {
  minecraft: string;
  tier: OmegaTier;
  loaders: ("fabric" | "forge")[];
  modVersion: string;
}

interface OmegaSupportManifest {
  schemaVersion: number;
  versions: OmegaVersionSupport[];
}

/** Same rolling-release base as bundledMods.ts's RELEASE_JAR_BASE; the manifest is published alongside the jars. */
const REMOTE_MANIFEST_URL = "https://github.com/dsdocai-ops/Mods/releases/download/latest-build/omega-versions.json";

const MANIFEST_FILE_NAME = "omega-versions.json";

/**
 * The hardcoded floor: what the mod builds for today (matches the repo-root omega-versions.json and
 * mod/gradle.properties). Only reached when remote, cache, and bundled copies are all unavailable -
 * it exists so a fresh install with no network still knows about the shipping version.
 */
const DEFAULT_SUPPORT: OmegaVersionSupport[] = [
  { minecraft: "1.20.1", tier: "main", loaders: ["fabric", "forge"], modVersion: "0.1.0" },
];

/**
 * In-memory memo with a short TTL. getOmegaSupportManifest is called on every launch and every time
 * the version catalog is listed (which can be several times a session), and each call would
 * otherwise re-hit the network; caching the resolved list for a few minutes keeps that to at most
 * one fetch per window while still picking up a freshly-published port within that window.
 */
const MEMO_TTL_MS = 15 * 60 * 1000;
let memo: { at: number; value: OmegaVersionSupport[] } | null = null;

/** Where a bundled manifest can live: packaged builds stage it in resourcesPath/bundled; dev reads the repo-root file (app.getAppPath()). */
function manifestSearchPaths(): string[] {
  const paths: string[] = [];
  if (process.resourcesPath) paths.push(path.join(process.resourcesPath, "bundled", MANIFEST_FILE_NAME));
  paths.push(path.join(app.getAppPath(), MANIFEST_FILE_NAME));
  return paths;
}

function cacheManifestPath(): string {
  return path.join(app.getPath("userData"), MANIFEST_FILE_NAME);
}

/** A single entry is only kept if every field is the right shape; anything malformed is dropped rather than trusted. */
function isValidEntry(entry: any): entry is OmegaVersionSupport {
  if (!entry || typeof entry !== "object") return false;
  if (typeof entry.minecraft !== "string" || entry.minecraft.length === 0) return false;
  if (entry.tier !== "main" && entry.tier !== "bridge") return false;
  if (typeof entry.modVersion !== "string" || entry.modVersion.length === 0) return false;
  if (!Array.isArray(entry.loaders) || entry.loaders.length === 0) return false;
  return entry.loaders.every((l: unknown) => l === "fabric" || l === "forge");
}

/**
 * Validates a parsed manifest and returns its usable entries, or null on failure. A manifest with a
 * schemaVersion this launcher doesn't understand is rejected outright (fall through to an older
 * source); individual malformed entries are skipped, and if none survive the whole manifest is
 * treated as a failure so the chain falls through rather than serving an empty support list.
 */
function validateManifest(raw: unknown): OmegaVersionSupport[] | null {
  if (!raw || typeof raw !== "object") return null;
  const manifest = raw as OmegaSupportManifest;
  if (manifest.schemaVersion !== 1) return null;
  if (!Array.isArray(manifest.versions)) return null;
  const valid = manifest.versions.filter(isValidEntry);
  return valid.length > 0 ? valid : null;
}

function readManifestFile(filePath: string): OmegaVersionSupport[] | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return validateManifest(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch {
    return null;
  }
}

/** Best-effort persist of a freshly-fetched-and-validated manifest as the userData last-known-good cache. */
function persistCache(versions: OmegaVersionSupport[]): void {
  try {
    const dest = cacheManifestPath();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify({ schemaVersion: 1, versions }, null, 2), "utf-8");
  } catch {
    // A read-only userData or a disk-full is not worth failing over - next launch just refetches.
  }
}

/**
 * Resolves the support catalog via the fall-through chain described at the top of this file. Never
 * throws and never returns empty: the last step is a hardcoded default. Memoized for MEMO_TTL_MS.
 */
export async function getOmegaSupportManifest(): Promise<OmegaVersionSupport[]> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;

  let resolved: OmegaVersionSupport[] | null = null;

  // 1. Remote (freshest) - on success also refresh the userData cache.
  try {
    const response = await fetchWithRetry(REMOTE_MANIFEST_URL);
    if (response.ok) {
      const valid = validateManifest(await response.json());
      if (valid) {
        persistCache(valid);
        resolved = valid;
      }
    }
  } catch {
    // Offline / release down / bad JSON: fall through to the cache.
  }

  // 2. userData cache (last-known-good).
  if (!resolved) resolved = readManifestFile(cacheManifestPath());

  // 3. Bundled copy (packaged resourcesPath/bundled, or the dev repo-root file).
  if (!resolved) {
    for (const candidate of manifestSearchPaths()) {
      resolved = readManifestFile(candidate);
      if (resolved) break;
    }
  }

  // 4. Hardcoded floor.
  if (!resolved) resolved = DEFAULT_SUPPORT;

  memo = { at: Date.now(), value: resolved };
  return resolved;
}

/** The Omega support entry for a Minecraft version, or null if the mod doesn't ship a build for it. */
export async function omegaSupportFor(minecraftVersion: string): Promise<OmegaVersionSupport | null> {
  const manifest = await getOmegaSupportManifest();
  return manifest.find((entry) => entry.minecraft === minecraftVersion) ?? null;
}

/**
 * The full version catalog for the New Instance version picker: every Mojang mainline release (live
 * from the manifest, via the installer), each annotated with its Omega support tier/loaders/version
 * when the mod ships a build for it. Versions with no Omega entry come back plain (vanilla-playable,
 * the Omega mod simply skipped for them).
 */
export async function getVersionCatalog(): Promise<InstallableVersion[]> {
  const [versions, support] = await Promise.all([listInstallableVersions(), getOmegaSupportManifest()]);
  const byMc = new Map(support.map((entry) => [entry.minecraft, entry]));
  return versions.map((version) => {
    const entry = byMc.get(version.id);
    if (!entry) return version;
    return { ...version, omega: { tier: entry.tier, loaders: entry.loaders, modVersion: entry.modVersion } };
  });
}
