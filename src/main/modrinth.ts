// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Loader, ModrinthInstallProgress, ModrinthInstallResult, ModrinthSearchHit, ModrinthUpdate } from "../shared/types";
import { downloadFile, fetchWithRetry } from "./installer";
import { forgetModMetadata } from "./modMetadata";

const DISABLED_SUFFIX = ".disabled";

/**
 * In-launcher mod browser backed by Modrinth's public REST API (api.modrinth.com/v2) - the
 * "download mods straight into the client" flow. No API key or auth is needed for search or
 * downloads; mod authors opt their projects in. Downloads land in the instance's modsDir as plain
 * jars, so everything else (listMods, the toggle switches, tag presets) picks them up exactly like
 * a manually dropped file - this module only adds a new *way in*, it doesn't own the mods after.
 *
 * Reuses installer.ts's downloadFile (sha1-verified, retrying, skips already-present files) and
 * fetchWithRetry so mod downloads get the same resilience as version installs. Like installer.ts it
 * imports nothing from Electron, so the API-shape assumptions here can be smoke-tested under plain
 * Node against the real endpoints (the dev sandbox blocks api.modrinth.com, same as Mojang's CDNs).
 */

const API_BASE = "https://api.modrinth.com/v2";
// Modrinth's usage guidelines ask API clients to send a descriptive User-Agent identifying the app
// and a contact/URL, so a misbehaving client can be reached rather than blanket-rate-limited.
const USER_AGENT = "OmegaClient/1.0 (+https://github.com/dsdocai-ops/Mods)";
// Modrinth's CDN (not just the API) rejects UA-less requests outright, so the actual jar
// downloads below need this too, not just apiJson's metadata calls.
const DOWNLOAD_INIT: RequestInit = { headers: { "User-Agent": USER_AGENT } };
// A hard ceiling on how many jars one install can pull in, so a pathological/looping dependency
// graph can't turn a single click into an unbounded download. The visited-set below already breaks
// cycles; this is a belt-and-braces cap on breadth.
const MAX_INSTALL_FILES = 50;

/** Modrinth loader/category slug set, matched against our Loader union. Quilt can load Fabric mods, so it searches both. */
function loadersFor(loader: Loader): string[] {
  switch (loader) {
    case "fabric":
      return ["fabric"];
    case "quilt":
      return ["quilt", "fabric"];
    case "forge":
      return ["forge"];
    case "neoforge":
      return ["neoforge"];
    default:
      return []; // vanilla - no mod loader, nothing on Modrinth is compatible
  }
}

/**
 * Pulls the plain Minecraft version (e.g. "1.20.1") out of an instance's launchable version id.
 * Modrinth filters by the base game version, but a modded instance's versionId can be a loader
 * profile name like "fabric-loader-0.15.11-1.20.1" or "1.20.1-forge-47.2.0" - grab the last
 * MC-shaped token (1.x / 1.x.y), which is the actual game version in every one of those layouts.
 */
export function minecraftVersionOf(versionId: string): string {
  const matches = versionId.match(/1\.\d+(\.\d+)?/g);
  return matches ? matches[matches.length - 1] : versionId;
}

async function apiJson(pathAndQuery: string, init?: RequestInit): Promise<any> {
  const response = await fetchWithRetry(`${API_BASE}${pathAndQuery}`, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Modrinth request failed (${response.status}) for ${pathAndQuery}`);
  }
  return response.json();
}

/** Searches Modrinth for mods compatible with this instance's loader and Minecraft version. */
export async function searchModrinth(query: string, loader: Loader, versionId: string): Promise<ModrinthSearchHit[]> {
  const loaders = loadersFor(loader);
  if (loaders.length === 0) return []; // vanilla instance - nothing to install

  const gameVersion = minecraftVersionOf(versionId);
  // Facets: items inside one inner array are OR'd, the arrays themselves are AND'd. So this reads
  // "project_type is mod AND (loader is X or Y) AND game version is Z".
  const facets: string[][] = [["project_type:mod"], loaders.map((l) => `categories:${l}`)];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);

  const params = new URLSearchParams({
    limit: "20",
    index: "relevance",
    query: query.trim(),
    facets: JSON.stringify(facets),
  });
  const body = await apiJson(`/search?${params.toString()}`);
  return (body.hits ?? []).map(
    (h: any): ModrinthSearchHit => ({
      projectId: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description ?? "",
      author: h.author ?? "",
      downloads: h.downloads ?? 0,
      iconUrl: h.icon_url ?? "",
      categories: h.categories ?? [],
    })
  );
}

interface ModrinthFile {
  url: string;
  filename: string;
  primary: boolean;
  hashes?: { sha1?: string };
}
interface ModrinthVersion {
  name: string;
  version_number: string;
  project_id?: string;
  files: ModrinthFile[];
  dependencies?: Array<{ project_id?: string; version_id?: string; dependency_type?: string }>;
}

/** Picks the version to install for a project under this loader/game version - the newest primary-file build Modrinth returns first. */
async function bestVersion(projectId: string, loaders: string[], gameVersion: string): Promise<ModrinthVersion | null> {
  const params = new URLSearchParams({ loaders: JSON.stringify(loaders) });
  if (gameVersion) params.set("game_versions", JSON.stringify([gameVersion]));
  const versions: ModrinthVersion[] = await apiJson(`/project/${projectId}/version?${params.toString()}`);
  // Modrinth returns these newest-first already; take the first with a downloadable file.
  return versions.find((v) => (v.files ?? []).length > 0) ?? null;
}

function primaryFile(version: ModrinthVersion): ModrinthFile | null {
  const files = version.files ?? [];
  return files.find((f) => f.primary) ?? files[0] ?? null;
}

interface PlannedDownload {
  name: string;
  url: string;
  filename: string;
  sha1?: string;
}

/**
 * Depth-first walk of a project's required-dependency graph, appending each resolvable jar to
 * `plan`. `satisfied` doubles as the visited-set AND the "already have this, skip it" set: install
 * seeds it empty, update seeds it with the projects already present in modsDir so a dependency
 * that's already installed isn't downloaded again. `isRoot` decides whether "no compatible build"
 * is a hard error (the thing the user actually asked for) or a soft skip (a transitive dependency,
 * recorded in `skipped` and surfaced as a warning). Only *required* dependencies are followed -
 * optional ones are the user's choice, embedded ones already ship inside the jar.
 */
async function resolveProject(
  projectId: string,
  pinnedVersionId: string | undefined,
  isRoot: boolean,
  loader: Loader,
  loaders: string[],
  gameVersion: string,
  satisfied: Set<string>,
  plan: PlannedDownload[],
  skipped: string[],
  onProgress: (progress: ModrinthInstallProgress) => void
): Promise<void> {
  if (satisfied.has(projectId) || plan.length >= MAX_INSTALL_FILES) return;
  satisfied.add(projectId);
  onProgress({ phase: "resolving", name: projectId, done: plan.length, total: plan.length, detail: "Resolving dependencies..." });

  let version: ModrinthVersion | null = null;
  if (pinnedVersionId) version = await apiJson(`/version/${pinnedVersionId}`).catch(() => null);
  if (!version) version = await bestVersion(projectId, loaders, gameVersion);

  if (!version) {
    if (isRoot) throw new Error(`No ${loader} build of this mod exists for Minecraft ${gameVersion}.`);
    skipped.push(projectId);
    return;
  }
  const file = primaryFile(version);
  if (!file?.url) {
    if (isRoot) throw new Error("Modrinth returned no downloadable file for this mod.");
    skipped.push(projectId);
    return;
  }

  plan.push({ name: version.name || version.version_number || file.filename, url: file.url, filename: file.filename, sha1: file.hashes?.sha1 });

  for (const dep of version.dependencies ?? []) {
    if (dep.dependency_type !== "required" || !dep.project_id) continue;
    await resolveProject(dep.project_id, dep.version_id, false, loader, loaders, gameVersion, satisfied, plan, skipped, onProgress);
  }
}

/**
 * The set of Modrinth project ids already installed in modsDir, found by hashing the jars and asking
 * Modrinth (`/version_files`) which version each hash is. Used to seed an update's `satisfied` set so
 * dependency resolution skips mods you already have. Best-effort: on any failure it returns what it
 * has (an empty set just means updates may re-download an already-present dependency, never wrong).
 */
async function presentProjectIds(modsDir: string): Promise<Set<string>> {
  const projects = new Set<string>();
  if (!fs.existsSync(modsDir)) return projects;
  const jars = fs.readdirSync(modsDir, { withFileTypes: true }).filter((e) => e.isFile() && isJarLike(e.name));
  if (jars.length === 0) return projects;

  const hashes = jars.map((e) => sha1OfFile(path.join(modsDir, e.name)));
  const response = await apiJson("/version_files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes, algorithm: "sha1" }),
  }).catch(() => ({}));
  for (const version of Object.values((response ?? {}) as Record<string, ModrinthVersion>)) {
    if (version?.project_id) projects.add(version.project_id);
  }
  return projects;
}

/**
 * Downloads a Modrinth project - and every *required* dependency, recursively - into modsDir.
 * Required deps with no build matching this instance's loader/version are recorded and reported
 * rather than aborting the whole install.
 */
export async function installFromModrinth(
  modsDir: string,
  projectId: string,
  loader: Loader,
  versionId: string,
  onProgress: (progress: ModrinthInstallProgress) => void
): Promise<ModrinthInstallResult> {
  const loaders = loadersFor(loader);
  if (loaders.length === 0) {
    throw new Error("This instance has no mod loader (Fabric/Forge/Quilt/NeoForge) - mods can't be installed into it.");
  }
  const gameVersion = minecraftVersionOf(versionId);
  fs.mkdirSync(modsDir, { recursive: true });

  const plan: PlannedDownload[] = [];
  const skippedDependencies: string[] = [];
  await resolveProject(projectId, undefined, true, loader, loaders, gameVersion, new Set(), plan, skippedDependencies, onProgress);

  let done = 0;
  const total = plan.length;
  for (const item of plan) {
    onProgress({ phase: "downloading", name: item.name, done, total, detail: `Downloading ${item.name} (${done + 1}/${total})...` });
    // path.basename guards against a crafted filename with "../" segments escaping modsDir - same
    // guard mods.ts/shaders.ts apply to every file name they write.
    await downloadFile(item.url, path.join(modsDir, path.basename(item.filename)), item.sha1, DOWNLOAD_INIT);
    done++;
  }

  onProgress({ phase: "done", name: "", done, total, detail: `Installed ${done} file${done === 1 ? "" : "s"}.` });
  return { installedFiles: plan.map((p) => path.basename(p.filename)), skippedDependencies };
}

function isJarLike(fileName: string): boolean {
  const stripped = fileName.endsWith(DISABLED_SUFFIX) ? fileName.slice(0, -DISABLED_SUFFIX.length) : fileName;
  return stripped.toLowerCase().endsWith(".jar");
}

function sha1OfFile(filePath: string): string {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * Finds which installed jars have a newer compatible build on Modrinth. Rather than tracking where
 * each jar came from, it sha1-hashes every jar in modsDir and asks Modrinth's `/version_files/update`
 * endpoint for the latest version matching this instance's loader + Minecraft version - the same
 * hash-lookup mechanism other launchers use. Jars Modrinth doesn't recognize (hand-built mods, the
 * bundled Omega mod) simply don't come back and are ignored. Enabled and disabled jars are both
 * checked; the `.disabled` state is carried through so an update preserves it.
 */
export async function checkModrinthUpdates(modsDir: string, loader: Loader, versionId: string): Promise<ModrinthUpdate[]> {
  const loaders = loadersFor(loader);
  if (loaders.length === 0 || !fs.existsSync(modsDir)) return [];
  const gameVersion = minecraftVersionOf(versionId);

  const jars = fs.readdirSync(modsDir, { withFileTypes: true }).filter((e) => e.isFile() && isJarLike(e.name));
  if (jars.length === 0) return [];

  // Content-hash every jar. Two jars with identical bytes (an enabled + a .disabled copy) would
  // collide on one hash - fine, Modrinth's response is keyed by hash and we map back to whichever
  // file(s) carry it below.
  const byHash = new Map<string, Array<{ fileName: string; enabled: boolean }>>();
  for (const entry of jars) {
    const hash = sha1OfFile(path.join(modsDir, entry.name));
    const list = byHash.get(hash) ?? [];
    list.push({ fileName: entry.name, enabled: !entry.name.endsWith(DISABLED_SUFFIX) });
    byHash.set(hash, list);
  }

  const body = { hashes: [...byHash.keys()], algorithm: "sha1", loaders, game_versions: gameVersion ? [gameVersion] : [] };
  const response = await apiJson("/version_files/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const updates: ModrinthUpdate[] = [];
  for (const [inputHash, version] of Object.entries((response ?? {}) as Record<string, ModrinthVersion>)) {
    const locals = byHash.get(inputHash);
    if (!locals) continue;
    const file = primaryFile(version);
    const newSha1 = file?.hashes?.sha1;
    // Same hash back = already on the latest build for this loader/version - not an update.
    if (!file?.url || !newSha1 || newSha1 === inputHash) continue;
    for (const local of locals) {
      updates.push({
        fileName: local.fileName,
        newVersion: version.version_number,
        projectId: version.project_id ?? "",
        url: file.url,
        newFileName: file.filename,
        sha1: newSha1,
        enabled: local.enabled,
      });
    }
  }
  return updates;
}

/**
 * Applies the updates from checkModrinthUpdates: downloads each newer jar into modsDir (preserving
 * the mod's enabled/disabled state via the `.disabled` suffix) and removes the old jar when the file
 * name changed. A same-name update just overwrites in place (downloadFile re-fetches on hash
 * mismatch). Then it resolves any *new* required dependencies the updated builds introduce and
 * installs the ones not already present, so an update that started needing (say) a new library mod
 * doesn't silently fail to load. Reuses the mod-install progress channel.
 */
export async function applyModrinthUpdates(
  modsDir: string,
  updates: ModrinthUpdate[],
  loader: Loader,
  versionId: string,
  onProgress: (progress: ModrinthInstallProgress) => void
): Promise<ModrinthInstallResult> {
  const loaders = loadersFor(loader);
  const gameVersion = minecraftVersionOf(versionId);
  fs.mkdirSync(modsDir, { recursive: true });

  // What's already installed (by Modrinth project id) so dependency resolution below skips it. Seed
  // it before touching disk, then add the updated projects themselves - a mod never counts as its
  // own new dependency.
  const satisfied = await presentProjectIds(modsDir);
  for (const update of updates) if (update.projectId) satisfied.add(update.projectId);

  const installedFiles: string[] = [];
  const skippedDependencies: string[] = [];
  let done = 0;

  // Phase 1: the updated jars themselves.
  for (const update of updates) {
    onProgress({ phase: "downloading", name: update.newFileName, done, total: updates.length, detail: `Updating ${update.newFileName} (${done + 1}/${updates.length})...` });
    // path.basename guards the Modrinth-supplied name against "../" traversal, same as installFromModrinth.
    const targetName = path.basename(update.newFileName) + (update.enabled ? "" : DISABLED_SUFFIX);
    const targetPath = path.join(modsDir, targetName);
    await downloadFile(update.url, targetPath, update.sha1, DOWNLOAD_INIT);

    const oldPath = path.join(modsDir, path.basename(update.fileName));
    if (path.resolve(oldPath) !== path.resolve(targetPath) && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
      forgetModMetadata(oldPath);
    }
    installedFiles.push(targetName);
    done++;
  }

  // Phase 2: new required dependencies the updated versions introduce. Re-read each updated version
  // (bestVersion returns the same latest build checkModrinthUpdates matched) purely for its
  // dependency list, then resolve required deps - skipping anything in `satisfied` (already present
  // or already updated). New deps are installed enabled.
  if (loaders.length > 0) {
    const depPlan: PlannedDownload[] = [];
    for (const update of updates) {
      if (!update.projectId) continue;
      const version = await bestVersion(update.projectId, loaders, gameVersion);
      for (const dep of version?.dependencies ?? []) {
        if (dep.dependency_type !== "required" || !dep.project_id) continue;
        await resolveProject(dep.project_id, dep.version_id, false, loader, loaders, gameVersion, satisfied, depPlan, skippedDependencies, onProgress);
      }
    }

    const total = updates.length + depPlan.length;
    for (const item of depPlan) {
      onProgress({ phase: "downloading", name: item.name, done, total, detail: `Installing new dependency ${item.name} (${done + 1}/${total})...` });
      await downloadFile(item.url, path.join(modsDir, path.basename(item.filename)), item.sha1, DOWNLOAD_INIT);
      installedFiles.push(path.basename(item.filename));
      done++;
    }
  }

  const newDeps = installedFiles.length - updates.length;
  onProgress({
    phase: "done",
    name: "",
    done,
    total: done,
    detail: `Updated ${updates.length} mod${updates.length === 1 ? "" : "s"}${newDeps > 0 ? ` (+${newDeps} new dependenc${newDeps === 1 ? "y" : "ies"})` : ""}.`,
  });
  return { installedFiles, skippedDependencies };
}
