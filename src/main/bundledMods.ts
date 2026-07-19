// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { Instance } from "../shared/types";
import { fetchWithRetry } from "./installer";
import { resolveVersion } from "./versionResolver";

/**
 * Lunar-style "the client IS the mods": the Omega companion mod ships inside the launcher and is
 * (re)installed into every instance automatically on creation and before every launch, so its
 * features are just *launcher features* - no manual jar wrangling. The jars come from three
 * sources, tried in order:
 *
 *  1. The packaged app's extraResources (process.resourcesPath/bundled) - CI stages the freshly
 *     built jars there before electron-builder runs.
 *  2. A repo-root bundled/ dir - dev-mode equivalent, populated by hand or a downloaded artifact.
 *  3. The repo's rolling "latest-build" GitHub Release - dev fallback so a plain git clone still
 *     self-provisions, cached in userData.
 *
 * The Fabric build of the mod depends on Fabric API, which we don't own and don't bundle -
 * it's fetched from Modrinth (the platform built exactly for this) and cached per-MC-version.
 * This is the one deliberate exception to the launcher's original "never downloads third-party
 * mod jars" rule, and only ever happens for instances the user points the launcher at.
 */

const RELEASE_JAR_BASE = "https://github.com/dsdocai-ops/Mods/releases/download/latest-build";
const MODRINTH_API = "https://api.modrinth.com/v2";

/**
 * Modrinth's API terms require a uniquely-identifying User-Agent, and their CDN rejects UA-less
 * requests outright - Node's fetch (undici) sends NO User-Agent by default, so every Modrinth call
 * without this header fails with a 4xx before it ever reaches the API. Harmless on the GitHub
 * release fallback that also flows through downloadToCache.
 */
export const MODRINTH_HEADERS: Record<string, string> = {
  "User-Agent": "dsdocai-ops/Mods (Omega Client launcher)",
};

/**
 * The Minecraft versions the Omega mod actually ships a build for. Placing an Omega jar built for a
 * version the instance isn't running isn't a soft failure: Fabric/Forge refuse to load a mod whose
 * declared "minecraft" dependency doesn't match and abort the whole launch over it, so an instance on
 * an unsupported version must be skipped *before* any jar is copied in, not left to surface at launch.
 *
 * This is the launcher-side half of the multi-version architecture (see mod/README.md's "Multi-version
 * architecture" section). Adding a version here is a one-line change - but only once the mod build
 * actually produces (and the release actually publishes) a jar built against that version's mappings;
 * this list must never get ahead of what `omegaJarFor` can really fetch, or a matching instance would
 * be handed a jar that doesn't exist. Today the mod builds for exactly one version, so this has one
 * entry that matches mod/gradle.properties' `minecraft_version`.
 */
const OMEGA_MOD_MINECRAFT_VERSIONS: readonly string[] = ["1.20.1"];

/** Whether the Omega mod ships a build compatible with the given Minecraft version. */
export function omegaModSupportsVersion(minecraftVersion: string): boolean {
  return OMEGA_MOD_MINECRAFT_VERSIONS.includes(minecraftVersion);
}

type OmegaLoader = "fabric" | "forge";

function cacheDir(): string {
  return path.join(app.getPath("userData"), "mod-cache");
}

/** Where CI-staged (packaged) or hand-staged (dev) bundled jars live, if anywhere. */
function bundledDirs(): string[] {
  const dirs: string[] = [];
  if (process.resourcesPath) dirs.push(path.join(process.resourcesPath, "bundled"));
  dirs.push(path.join(app.getAppPath(), "bundled"));
  return dirs;
}

function findBundledJar(loader: OmegaLoader, minecraftVersion: string): string | null {
  // Jars are named omega-client-<loader>-<mcVersion>-<modVersion>.jar (see the mod's build.gradle),
  // so the version prefix is what selects the right one when jars for several MC versions are bundled
  // side by side. `-` after the version guards against a prefix like "1.20.1" matching "1.20.10".
  const prefix = `omega-client-${loader}-${minecraftVersion}-`;
  for (const dir of bundledDirs()) {
    if (!fs.existsSync(dir)) continue;
    const match = fs
      .readdirSync(dir)
      .find((f) => f.startsWith(prefix) && f.endsWith(".jar") && !f.includes("-sources"));
    if (match) return path.join(dir, match);
  }
  return null;
}

export async function downloadToCache(url: string, fileName: string): Promise<string> {
  const dest = path.join(cacheDir(), fileName);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  const response = await fetchWithRetry(url, { headers: MODRINTH_HEADERS });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

/** The mod's own version (mod/gradle.properties' mod_version), which trails the MC version in every jar name. */
const OMEGA_MOD_VERSION = "0.1.0";

/** Bundled jar for this MC version if present, else the rolling release (dev fallback), cached. */
async function omegaJarFor(loader: OmegaLoader, minecraftVersion: string): Promise<string> {
  const bundled = findBundledJar(loader, minecraftVersion);
  if (bundled) return bundled;
  // Matches the mod build's archivesName: omega-client-<loader>-<mcVersion>-<modVersion>.jar.
  const releaseName = `omega-client-${loader}-${minecraftVersion}-${OMEGA_MOD_VERSION}.jar`;
  return downloadToCache(`${RELEASE_JAR_BASE}/${releaseName}`, releaseName);
}

/**
 * Copies a jar into the instance's mods dir under a stable name. If the user has explicitly
 * disabled it (the .disabled variant exists), the disabled file is updated instead - "preinstalled"
 * must not mean "un-disableable".
 */
export function placeJar(sourceJar: string, modsDir: string, stableName: string): void {
  fs.mkdirSync(modsDir, { recursive: true });
  // Most callers pass a hardcoded name, but the Fabric API / Iris / Oculus / Sodium call sites
  // pass a filename read straight out of a Modrinth API response - path.basename keeps a
  // compromised/MITM'd response from writing outside modsDir, same guard as mods.ts/shaders.ts.
  const enabledPath = path.join(modsDir, path.basename(stableName));
  const disabledPath = `${enabledPath}.disabled`;
  const dest = fs.existsSync(disabledPath) ? disabledPath : enabledPath;
  fs.copyFileSync(sourceJar, dest);
}

/** True if any file that looks like the given mod id is already in the mods dir (enabled or not). */
export function hasModLike(modsDir: string, prefix: string): boolean {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some((f) => f.toLowerCase().startsWith(prefix) && f.includes(".jar"));
}

/** Latest Modrinth release of `projectSlug` compatible with an MC version + loader. */
async function modrinthLatestUrl(
  projectSlug: string,
  minecraftVersion: string,
  loader: "fabric" | "forge"
): Promise<{ url: string; fileName: string }> {
  const query = `${MODRINTH_API}/project/${projectSlug}/version?game_versions=${encodeURIComponent(
    JSON.stringify([minecraftVersion])
  )}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
  const response = await fetchWithRetry(query, { headers: MODRINTH_HEADERS });
  if (!response.ok) {
    throw new Error(`Modrinth query failed (${response.status})`);
  }
  const versions = (await response.json()) as any[];
  const release = versions.find((v) => v.version_type === "release") ?? versions[0];
  if (!release) {
    throw new Error(`No ${projectSlug} build on Modrinth for Minecraft ${minecraftVersion} (${loader}).`);
  }
  const file = release.files.find((f: any) => f.primary) ?? release.files[0];
  return { url: file.url, fileName: file.filename };
}

/** Latest Fabric API release for an MC version, from Modrinth. */
async function fabricApiUrl(minecraftVersion: string): Promise<{ url: string; fileName: string }> {
  return modrinthLatestUrl("fabric-api", minecraftVersion, "fabric");
}

/** Which shader-loader project an instance's loader needs, or null if its loader can't do shaders. */
function shaderLoaderFor(instance: Instance): { loader: "fabric" | "forge"; project: "iris" | "oculus" } | null {
  if (instance.loader === "fabric" || instance.loader === "quilt") return { loader: "fabric", project: "iris" };
  if (instance.loader === "forge") return { loader: "forge", project: "oculus" };
  return null; // vanilla/neoforge: no shader loader available (yet)
}

/**
 * Whether a shader loader (Iris on Fabric, Oculus on Forge) is already present in the instance -
 * lets the Shaders tab show an install prompt only when one is actually needed. Vanilla/NeoForge
 * report "true" because there's nothing to install for them (the UI gates those with its own hint).
 */
export function hasShaderLoader(instance: Instance): boolean {
  const target = shaderLoaderFor(instance);
  if (!target) return true;
  return hasModLike(instance.modsDir, target.project);
}

/**
 * Installs a shader loader (Iris + Sodium on Fabric, Oculus + its bundled Rubidium on Forge) into an
 * instance from Modrinth. These are third-party, independently-owned mods (Iris/Sodium/Oculus are
 * LGPL-3.0) that Omega does not own or bundle - so, unlike the Omega mod and its own Fabric API
 * dependency, this is NOT run automatically. It only happens when the user explicitly asks for
 * shader support (the "Install shader loader" button in the Shaders tab), which keeps the launcher's
 * "don't silently pull in other people's mods" principle intact and gives proper, visible intent.
 * Throws on failure so the UI can report it. Returns the file names it installed.
 */
export async function installShaderSupport(instance: Instance, log: (line: string) => void): Promise<{ installed: string[] }> {
  const target = shaderLoaderFor(instance);
  if (!target) {
    throw new Error("Shaders need a Fabric or Forge instance - this instance's loader has no shader loader available.");
  }

  const resolved = resolveVersion(instance.gameDir, instance.versionId);
  const minecraftVersion = resolved.chainIds[resolved.chainIds.length - 1];
  const installed: string[] = [];

  if (!hasModLike(instance.modsDir, target.project)) {
    const { url, fileName } = await modrinthLatestUrl(target.project, minecraftVersion, target.loader);
    const cached = await downloadToCache(url, fileName);
    placeJar(cached, instance.modsDir, fileName);
    installed.push(fileName);
    log(`[launcher] ${target.project === "iris" ? "Iris" : "Oculus"} (${fileName}) installed from Modrinth`);
  }

  // Iris on Fabric needs Sodium as a separate dependency (not bundled inside its own jar); Oculus
  // on Forge brings its Sodium fork (Rubidium) in as its own dependency chain, so only Fabric needs
  // this extra fetch.
  if (target.loader === "fabric" && !hasModLike(instance.modsDir, "sodium")) {
    const { url, fileName } = await modrinthLatestUrl("sodium", minecraftVersion, "fabric");
    const cached = await downloadToCache(url, fileName);
    placeJar(cached, instance.modsDir, fileName);
    installed.push(fileName);
    log(`[launcher] Sodium (${fileName}) installed from Modrinth`);
  }

  return { installed };
}

/**
 * Makes sure the Omega mod (and its dependencies) are present in an instance's mods folder.
 * Never throws: a network hiccup here must not block instance creation or launching - the game
 * just runs without the companion mod that round, and the next create/launch retries.
 */
export async function ensureOmegaMods(instance: Instance, log: (line: string) => void): Promise<void> {
  const loader = instance.loader === "fabric" || instance.loader === "quilt" ? "fabric" : instance.loader === "forge" ? "forge" : null;
  if (!loader) return; // vanilla/neoforge instances: nothing to preinstall (yet)

  // The vanilla root of the version chain is the actual MC version (e.g. "1.20.1"), even when the
  // instance's own version id is a fabric-loader/forge profile.
  let minecraftVersion: string;
  try {
    const resolved = resolveVersion(instance.gameDir, instance.versionId);
    minecraftVersion = resolved.chainIds[resolved.chainIds.length - 1];
  } catch (err) {
    log(`[launcher] warning: couldn't resolve this instance's Minecraft version, skipping the Omega ${loader} mod: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!omegaModSupportsVersion(minecraftVersion)) {
    log(
      `[launcher] Omega ${loader} mod skipped - this instance is Minecraft ${minecraftVersion}, and the mod is only built for ${OMEGA_MOD_MINECRAFT_VERSIONS.join(", ")} so far`
    );
    return;
  }

  try {
    const jar = await omegaJarFor(loader, minecraftVersion);
    placeJar(jar, instance.modsDir, `omega-client-${loader}.jar`);
    log(`[launcher] Omega ${loader} mod installed/updated in mods folder`);
  } catch (err) {
    log(`[launcher] warning: couldn't provision the Omega ${loader} mod: ${err instanceof Error ? err.message : String(err)}`);
    return; // Without our own jar there's no point fetching its dependency.
  }

  if (loader === "fabric" && !hasModLike(instance.modsDir, "fabric-api")) {
    try {
      const { url, fileName } = await fabricApiUrl(minecraftVersion);
      const cached = await downloadToCache(url, fileName);
      placeJar(cached, instance.modsDir, fileName);
      log(`[launcher] Fabric API (${fileName}) installed from Modrinth`);
    } catch (err) {
      log(`[launcher] warning: couldn't fetch Fabric API from Modrinth: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
