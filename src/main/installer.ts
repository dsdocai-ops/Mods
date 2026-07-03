import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { InstallableVersion, InstallProgress } from "../shared/types";
import { rulesAllow, mavenNameToPath, safeLibraryPath, type LibraryEntry } from "./versionResolver";

/**
 * Downloads/installs Minecraft versions into a standard vanilla-launcher-shaped game directory
 * (versions/, libraries/, assets/) - the same layout the rest of this launcher already knows how
 * to read and launch. Three paths:
 *
 *  - Vanilla: pure HTTP against Mojang's own piston-meta/resources CDNs (manifest -> version JSON
 *    -> client jar + rule-filtered libraries + asset index/objects), sha1-verified where Mojang
 *    provides hashes.
 *  - Fabric: the Fabric meta API serves a ready-made version JSON (profile); its libraries are
 *    plain maven coordinates downloaded from the URL each entry names. Needs the base vanilla
 *    version installed first, which installFabric handles.
 *  - Forge: no stable HTTP-only path exists - Forge's installer runs binary patchers to produce
 *    the client. So we do what every third-party launcher does: download the official installer
 *    jar and run it headlessly (java -jar installer --installClient <dir>).
 *
 * Deliberately imports nothing from Electron: CI smoke-tests this module by running the compiled
 * JS under plain Node against the real Mojang endpoints (see scripts/install-smoke.cjs), which is
 * the only real network verification this project can do - the dev sandbox blocks these hosts.
 */

const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSET_BASE_URL = "https://resources.download.minecraft.net";
const FABRIC_META_URL = "https://meta.fabricmc.net/v2";
const FORGE_PROMOTIONS_URL = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const FORGE_MAVEN_URL = "https://maven.minecraftforge.net/net/minecraftforge/forge";

/** Parallel downloads for the many-small-files phases (asset objects, libraries). */
const DOWNLOAD_CONCURRENCY = 12;
/**
 * Attempts per request. Across the hundreds of CDN connections an install makes, an occasional
 * ETIMEDOUT/reset is normal, not fatal - the smoke test's very first real run proved it by dying
 * on exactly one - and a user on imperfect WiFi hits the same thing. Connection errors and 5xx
 * retry with backoff; 4xx is permanent and fails immediately.
 */
const FETCH_ATTEMPTS = 3;
/**
 * Per-attempt cap. Plain fetch() has no default timeout - a connection that stalls after opening
 * (rather than failing outright) hangs forever, and since runPool's Promise.all waits on every
 * worker, one stuck download blocks the whole install permanently. Worse, main.ts's installInFlight
 * guard only clears in a finally that a promise which never settles also never reaches, so a single
 * stalled connection would brick every future install attempt until the app restarts.
 */
const FETCH_TIMEOUT_MS = 30_000;

export type ProgressCallback = (progress: InstallProgress) => void;

interface ManifestEntry {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
}

export async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.status >= 500) {
        throw new Error(`Server error (${response.status}) for ${url}`);
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function sha1Of(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

/** Downloads one file, verifying sha1 when known. Skips work when the file already exists with the right hash/size. */
async function downloadFile(url: string, destPath: string, expectedSha1?: string): Promise<void> {
  if (fs.existsSync(destPath)) {
    if (!expectedSha1) return;
    const existing = fs.readFileSync(destPath);
    if (sha1Of(existing) === expectedSha1) return;
    // Wrong content on disk (partial download from a previous crash?) - re-fetch below.
  }

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (expectedSha1 && sha1Of(buffer) !== expectedSha1) {
    throw new Error(`Checksum mismatch for ${url}`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

/** Runs jobs with bounded parallelism - thousands of sequential asset downloads would be painfully slow, unbounded ones would trip rate limits. */
async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, onItemDone: () => void): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
      onItemDone();
    }
  });
  await Promise.all(runners);
}

export async function listInstallableVersions(): Promise<InstallableVersion[]> {
  const manifest = await fetchJson(VERSION_MANIFEST_URL);
  return (manifest.versions as ManifestEntry[])
    .filter((v) => v.type === "release")
    .map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }));
}

export interface VanillaInstallOptions {
  /** Skip downloading the individual asset objects (textures/sounds). Used by the CI smoke test to keep runtime sane; a real install needs them. */
  skipAssetObjects?: boolean;
}

/** Installs a vanilla version into gameDir. Idempotent: everything already present (and hash-valid) is skipped. */
export async function installVanilla(
  gameDir: string,
  versionId: string,
  onProgress: ProgressCallback,
  options: VanillaInstallOptions = {}
): Promise<void> {
  onProgress({ phase: "manifest", done: 0, total: 1, detail: "Fetching version list..." });
  const manifest = await fetchJson(VERSION_MANIFEST_URL);
  const entry = (manifest.versions as ManifestEntry[]).find((v) => v.id === versionId);
  if (!entry) {
    throw new Error(`Unknown Minecraft version "${versionId}".`);
  }

  onProgress({ phase: "version-json", done: 0, total: 1, detail: `Fetching ${versionId}.json...` });
  const versionJson = await fetchJson(entry.url);
  const versionDir = path.join(gameDir, "versions", versionId);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2), "utf-8");

  const client = versionJson.downloads?.client;
  if (!client?.url) {
    throw new Error(`Version JSON for ${versionId} has no client download.`);
  }
  onProgress({ phase: "client-jar", done: 0, total: 1, detail: "Downloading client jar..." });
  await downloadFile(client.url, path.join(versionDir, `${versionId}.jar`), client.sha1);

  // Libraries: everything the OS rules allow, including natives classifiers where present
  // (pre-1.19 style) - newer versions ship natives as separate rule-gated artifact entries, which
  // this same loop covers.
  const libraries: LibraryEntry[] = versionJson.libraries ?? [];
  const downloads: Array<{ url: string; dest: string; sha1?: string }> = [];
  for (const lib of libraries) {
    if (!rulesAllow(lib.rules, {})) continue;
    const artifact = lib.downloads?.artifact;
    if (artifact?.url) {
      downloads.push({
        url: artifact.url,
        dest: path.join(gameDir, "libraries", safeLibraryPath(artifact.path ?? mavenNameToPath(lib.name))),
        sha1: artifact.sha1,
      });
    }
    for (const classified of Object.values(lib.downloads?.classifiers ?? {})) {
      if (classified?.url && classified.path) {
        downloads.push({ url: classified.url, dest: path.join(gameDir, "libraries", safeLibraryPath(classified.path)), sha1: classified.sha1 });
      }
    }
  }
  let done = 0;
  onProgress({ phase: "libraries", done, total: downloads.length, detail: "Downloading libraries..." });
  await runPool(downloads, (d) => downloadFile(d.url, d.dest, d.sha1), () => {
    done++;
    onProgress({ phase: "libraries", done, total: downloads.length, detail: `Libraries ${done}/${downloads.length}` });
  });

  // Assets: the index json, then the content-addressed objects it lists.
  const assetIndex = versionJson.assetIndex;
  if (assetIndex?.url) {
    const indexDest = path.join(gameDir, "assets", "indexes", `${assetIndex.id}.json`);
    await downloadFile(assetIndex.url, indexDest, assetIndex.sha1);

    if (!options.skipAssetObjects) {
      const index = JSON.parse(fs.readFileSync(indexDest, "utf-8"));
      const objects = Object.values(index.objects ?? {}) as Array<{ hash: string }>;
      const unique = [...new Map(objects.map((o) => [o.hash, o])).values()];
      let assetsDone = 0;
      onProgress({ phase: "assets", done: 0, total: unique.length, detail: "Downloading assets..." });
      await runPool(
        unique,
        (o) => {
          const prefix = o.hash.slice(0, 2);
          // Content-addressed: the path *is* the hash, so an existing file needs no re-verify.
          const dest = path.join(gameDir, "assets", "objects", prefix, o.hash);
          if (fs.existsSync(dest)) return Promise.resolve();
          return downloadFile(`${ASSET_BASE_URL}/${prefix}/${o.hash}`, dest, o.hash);
        },
        () => {
          assetsDone++;
          if (assetsDone % 50 === 0 || assetsDone === unique.length) {
            onProgress({ phase: "assets", done: assetsDone, total: unique.length, detail: `Assets ${assetsDone}/${unique.length}` });
          }
        }
      );
    }
  }
}

/** Installs the Fabric loader profile on top of a vanilla version (installing that vanilla version first). Returns the new launchable version id. */
export async function installFabric(gameDir: string, minecraftVersion: string, onProgress: ProgressCallback): Promise<string> {
  await installVanilla(gameDir, minecraftVersion, onProgress);

  onProgress({ phase: "fabric-profile", done: 0, total: 1, detail: "Fetching Fabric loader info..." });
  const loaders = await fetchJson(`${FABRIC_META_URL}/versions/loader/${minecraftVersion}`);
  const stable = loaders.find((l: any) => l.loader?.stable) ?? loaders[0];
  if (!stable) {
    throw new Error(`No Fabric loader available for Minecraft ${minecraftVersion}.`);
  }
  const loaderVersion = stable.loader.version;

  const profile = await fetchJson(`${FABRIC_META_URL}/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`);
  const profileId: string = profile.id;
  const profileDir = path.join(gameDir, "versions", profileId);
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, `${profileId}.json`), JSON.stringify(profile, null, 2), "utf-8");

  // Fabric profile libraries are bare maven coordinates + a repo base URL, no per-file hashes.
  const libs: Array<{ name: string; url?: string }> = profile.libraries ?? [];
  let done = 0;
  onProgress({ phase: "libraries", done, total: libs.length, detail: "Downloading Fabric libraries..." });
  await runPool(
    libs,
    (lib) => {
      if (!lib.url) return Promise.resolve();
      const relPath = mavenNameToPath(lib.name);
      const base = lib.url.endsWith("/") ? lib.url : `${lib.url}/`;
      return downloadFile(`${base}${relPath}`, path.join(gameDir, "libraries", relPath));
    },
    () => {
      done++;
      onProgress({ phase: "libraries", done, total: libs.length, detail: `Fabric libraries ${done}/${libs.length}` });
    }
  );

  return profileId;
}

/** Installs Forge by running the official installer headlessly. Returns the new launchable version id. */
export async function installForge(
  gameDir: string,
  minecraftVersion: string,
  javaPath: string,
  onProgress: ProgressCallback
): Promise<string> {
  await installVanilla(gameDir, minecraftVersion, onProgress);

  onProgress({ phase: "forge-installer", done: 0, total: 3, detail: "Finding latest Forge build..." });
  const promotions = await fetchJson(FORGE_PROMOTIONS_URL);
  const build: string | undefined = promotions.promos?.[`${minecraftVersion}-recommended`] ?? promotions.promos?.[`${minecraftVersion}-latest`];
  if (!build) {
    throw new Error(`No Forge build published for Minecraft ${minecraftVersion}.`);
  }
  const forgeVersion = `${minecraftVersion}-${build}`;

  onProgress({ phase: "forge-installer", done: 1, total: 3, detail: `Downloading Forge ${forgeVersion} installer...` });
  const installerPath = path.join(gameDir, `forge-${forgeVersion}-installer.jar`);
  await downloadFile(`${FORGE_MAVEN_URL}/${forgeVersion}/forge-${forgeVersion}-installer.jar`, installerPath);

  // The Forge installer refuses to run against a directory without launcher_profiles.json (it
  // patches the official launcher's profile list). A stub satisfies it.
  const profilesPath = path.join(gameDir, "launcher_profiles.json");
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), "utf-8");
  }

  const versionsBefore = new Set(fs.existsSync(path.join(gameDir, "versions")) ? fs.readdirSync(path.join(gameDir, "versions")) : []);

  onProgress({ phase: "forge-installer", done: 2, total: 3, detail: "Running Forge installer (takes a minute or two)..." });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(javaPath, ["-jar", installerPath, "--installClient", gameDir], { cwd: gameDir });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (err) => reject(new Error(`Couldn't run Java for the Forge installer: ${err.message}`)));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Forge installer failed (exit ${code}). Last output:\n${output.slice(-2000)}`));
    });
  });

  fs.rmSync(installerPath, { force: true });
  onProgress({ phase: "forge-installer", done: 3, total: 3, detail: "Forge installed." });

  // The installer names its version dir itself (e.g. "1.20.1-forge-47.2.0") - find what appeared.
  const versionsAfter = fs.readdirSync(path.join(gameDir, "versions"));
  const created = versionsAfter.find((v) => !versionsBefore.has(v) && v.toLowerCase().includes("forge"));
  if (created) return created;
  const existing = versionsAfter.find((v) => v.toLowerCase().includes("forge") && v.includes(minecraftVersion));
  if (existing) return existing;
  throw new Error("Forge installer finished but no Forge version directory was found.");
}
