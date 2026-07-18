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
 * The Omega mod is only ever built for one Minecraft version at a time - must match mod/gradle.properties'
 * minecraft_version, which both the Fabric and Forge builds share, and which fabric.mod.json/mods.toml
 * declare as their own "minecraft" dependency. Placing an Omega jar built for a different version isn't
 * a soft failure: Fabric/Forge refuse to load a mod whose declared Minecraft dependency doesn't match and
 * abort the entire launch over it, so this has to be checked *before* ever copying the jar in, not left
 * to surface as a launch failure.
 */
const OMEGA_MOD_MINECRAFT_VERSION = "1.20.1";

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

function findBundledJar(loader: OmegaLoader): string | null {
  for (const dir of bundledDirs()) {
    if (!fs.existsSync(dir)) continue;
    const match = fs
      .readdirSync(dir)
      .find((f) => f.startsWith(`omega-client-${loader}`) && f.endsWith(".jar") && !f.includes("-sources"));
    if (match) return path.join(dir, match);
  }
  return null;
}

async function downloadToCache(url: string, fileName: string): Promise<string> {
  const dest = path.join(cacheDir(), fileName);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

/** Bundled jar if present, else the rolling release (dev fallback), cached. */
async function omegaJarFor(loader: OmegaLoader): Promise<string> {
  const bundled = findBundledJar(loader);
  if (bundled) return bundled;
  // Version-specific file name in the release; 0.1.0 matches gradle.properties' mod_version.
  const releaseName = `omega-client-${loader}-0.1.0.jar`;
  return downloadToCache(`${RELEASE_JAR_BASE}/${releaseName}`, releaseName);
}

/**
 * Copies a jar into the instance's mods dir under a stable name. If the user has explicitly
 * disabled it (the .disabled variant exists), the disabled file is updated instead - "preinstalled"
 * must not mean "un-disableable".
 */
function placeJar(sourceJar: string, modsDir: string, stableName: string): void {
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
function hasModLike(modsDir: string, prefix: string): boolean {
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
  const response = await fetchWithRetry(query);
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

/**
 * The shaders capability itself ("can shaderpacks even be loaded") vs. which .zip is active
 * (managed separately - see shaders.ts) needs a shader-loading mod, which vanilla has none of:
 * Iris (+ its Sodium dependency) on Fabric, Oculus (which pulls in its own Sodium fork, Rubidium)
 * on Forge. Fetched from Modrinth the same way Fabric API is, and only ever added to instances the
 * user points the launcher at - never throws, same non-fatal contract as ensureOmegaMods.
 */
export async function ensureShaderSupport(instance: Instance, log: (line: string) => void): Promise<void> {
  const loader = instance.loader === "fabric" || instance.loader === "quilt" ? "fabric" : instance.loader === "forge" ? "forge" : null;
  if (!loader) return; // vanilla/neoforge: no shader loader to install (yet)

  const shaderLoaderProject = loader === "fabric" ? "iris" : "oculus";
  if (hasModLike(instance.modsDir, shaderLoaderProject)) return; // already present (bundled or user-added)

  let minecraftVersion: string;
  try {
    const resolved = resolveVersion(instance.gameDir, instance.versionId);
    minecraftVersion = resolved.chainIds[resolved.chainIds.length - 1];
  } catch (err) {
    log(`[launcher] warning: couldn't resolve Minecraft version for shader support: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  try {
    const { url, fileName } = await modrinthLatestUrl(shaderLoaderProject, minecraftVersion, loader);
    const cached = await downloadToCache(url, fileName);
    placeJar(cached, instance.modsDir, fileName);
    log(`[launcher] ${shaderLoaderProject === "iris" ? "Iris" : "Oculus"} (${fileName}) installed from Modrinth - shaderpacks can now be added`);
  } catch (err) {
    log(`[launcher] warning: couldn't fetch a shader loader from Modrinth: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  // Iris on Fabric needs Sodium as a separate dependency (not bundled inside its own jar); Oculus
  // on Forge brings its Sodium fork (Rubidium) in as its own dependency chain, so only Fabric needs
  // this extra fetch.
  if (loader === "fabric" && !hasModLike(instance.modsDir, "sodium")) {
    try {
      const { url, fileName } = await modrinthLatestUrl("sodium", minecraftVersion, "fabric");
      const cached = await downloadToCache(url, fileName);
      placeJar(cached, instance.modsDir, fileName);
      log(`[launcher] Sodium (${fileName}) installed from Modrinth`);
    } catch (err) {
      log(`[launcher] warning: couldn't fetch Sodium from Modrinth: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
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

  if (minecraftVersion !== OMEGA_MOD_MINECRAFT_VERSION) {
    log(
      `[launcher] Omega ${loader} mod skipped - it's only built for Minecraft ${OMEGA_MOD_MINECRAFT_VERSION} so far, this instance is ${minecraftVersion}`
    );
    return;
  }

  try {
    const jar = await omegaJarFor(loader);
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
