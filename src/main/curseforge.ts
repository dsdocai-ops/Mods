// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import type { CurseForgeInstallProgress, CurseForgeInstallResult, CurseForgeSearchHit, Loader } from "../shared/types";
import { downloadFile, fetchWithRetry } from "./installer";

/**
 * In-launcher mod browser backed by CurseForge's REST API (api.curseforge.com/v1) - the
 * "CurseForge" Discover segment, alongside Featured Mods (featuredMods.ts). Unlike Modrinth,
 * CurseForge requires a personal API key (from console.curseforge.com) sent as `x-api-key`; every
 * exported function here takes that key as a parameter rather than reading settings itself, so
 * this module stays a plain API client with no store.ts dependency.
 *
 * Reuses installer.ts's downloadFile (sha1-verified... though CurseForge's file listing doesn't
 * expose a hash the way Modrinth's does, so downloads here aren't hash-checked) and fetchWithRetry.
 */

const API_BASE = "https://api.curseforge.com/v1";
const GAME_ID_MINECRAFT = 432;
const CLASS_ID_MOD = 6;
// A hard ceiling on how many jars one install can pull in, mirroring modrinth.ts's guard.
const MAX_INSTALL_FILES = 50;

/** CurseForge's modLoaderType enum. Vanilla has no mod loader, so nothing on CurseForge is compatible. */
function modLoaderTypeFor(loader: Loader): number | null {
  switch (loader) {
    case "forge":
      return 1;
    case "fabric":
      return 4;
    case "quilt":
      return 5; // Quilt can load Fabric mods too; callers fall back to a Fabric-filtered search if a Quilt-only search comes up empty.
    case "neoforge":
      return 6;
    default:
      return null;
  }
}

/** Pulls the plain Minecraft version (e.g. "1.20.1") out of an instance's launchable version id - same heuristic as modrinth.ts's minecraftVersionOf. */
function minecraftVersionOf(versionId: string): string {
  const matches = versionId.match(/1\.\d+(\.\d+)?/g);
  return matches ? matches[matches.length - 1] : versionId;
}

async function apiJson(pathAndQuery: string, apiKey: string, init?: RequestInit): Promise<any> {
  if (!apiKey.trim()) {
    throw new Error("Add a CurseForge API key in Settings first (get one free at console.curseforge.com).");
  }
  const response = await fetchWithRetry(`${API_BASE}${pathAndQuery}`, {
    ...init,
    headers: { "x-api-key": apiKey, Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("CurseForge rejected the configured API key - check it in Settings.");
    }
    throw new Error(`CurseForge request failed (${response.status}) for ${pathAndQuery}`);
  }
  return response.json();
}

/** Searches CurseForge for mods compatible with this instance's loader and Minecraft version. */
export async function searchCurseForge(query: string, loader: Loader, versionId: string, apiKey: string): Promise<CurseForgeSearchHit[]> {
  const modLoaderType = modLoaderTypeFor(loader);
  if (modLoaderType === null) return []; // vanilla instance - nothing to install

  const gameVersion = minecraftVersionOf(versionId);
  const params = new URLSearchParams({
    gameId: String(GAME_ID_MINECRAFT),
    classId: String(CLASS_ID_MOD),
    searchFilter: query.trim(),
    modLoaderType: String(modLoaderType),
    sortField: "2", // popularity
    sortOrder: "desc",
    pageSize: "20",
  });
  if (gameVersion) params.set("gameVersion", gameVersion);

  const body = await apiJson(`/mods/search?${params.toString()}`, apiKey);
  return ((body.data ?? []) as any[]).map(
    (m): CurseForgeSearchHit => ({
      modId: m.id,
      slug: m.slug,
      name: m.name,
      summary: m.summary ?? "",
      author: (m.authors ?? [])[0]?.name ?? "",
      downloads: m.downloadCount ?? 0,
      iconUrl: m.logo?.thumbnailUrl ?? "",
      categories: (m.categories ?? []).map((c: any) => c.name),
    })
  );
}

interface CurseForgeFile {
  id: number;
  modId: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  dependencies?: Array<{ modId: number; relationType: number }>;
}

const REQUIRED_DEPENDENCY = 3;

/** Picks the file to install for a mod under this loader/game version - CurseForge returns these newest-first already. */
async function bestFile(modId: number, modLoaderType: number, gameVersion: string, apiKey: string): Promise<CurseForgeFile | null> {
  const params = new URLSearchParams({ modLoaderType: String(modLoaderType), pageSize: "1" });
  if (gameVersion) params.set("gameVersion", gameVersion);
  const body = await apiJson(`/mods/${modId}/files?${params.toString()}`, apiKey);
  return ((body.data ?? []) as CurseForgeFile[])[0] ?? null;
}

/** Some files have no `downloadUrl` (author disabled third-party distribution) - fall back to the dedicated endpoint before giving up. */
async function resolveDownloadUrl(file: CurseForgeFile, apiKey: string): Promise<string | null> {
  if (file.downloadUrl) return file.downloadUrl;
  const body = await apiJson(`/mods/${file.modId}/files/${file.id}/download-url`, apiKey).catch(() => null);
  return body?.data ?? null;
}

interface PlannedDownload {
  name: string;
  url: string;
  filename: string;
}

/**
 * Depth-first walk of a mod's required-dependency graph, appending each resolvable jar to `plan` -
 * mirrors modrinth.ts's resolveProject. Only *required* dependencies are followed.
 */
async function resolveMod(
  modId: number,
  isRoot: boolean,
  modLoaderType: number,
  gameVersion: string,
  apiKey: string,
  visited: Set<number>,
  plan: PlannedDownload[],
  skipped: string[],
  onProgress: (progress: CurseForgeInstallProgress) => void
): Promise<void> {
  if (visited.has(modId) || plan.length >= MAX_INSTALL_FILES) return;
  visited.add(modId);
  onProgress({ phase: "resolving", name: String(modId), done: plan.length, total: plan.length, detail: "Resolving dependencies..." });

  const file = await bestFile(modId, modLoaderType, gameVersion, apiKey);
  if (!file) {
    if (isRoot) throw new Error("No build of this mod exists for this loader/Minecraft version.");
    skipped.push(String(modId));
    return;
  }

  const url = await resolveDownloadUrl(file, apiKey);
  if (!url) {
    if (isRoot) throw new Error("CurseForge returned no downloadable file for this mod (the author disabled external downloads).");
    skipped.push(String(modId));
    return;
  }

  plan.push({ name: file.displayName || file.fileName, url, filename: file.fileName });

  for (const dep of file.dependencies ?? []) {
    if (dep.relationType !== REQUIRED_DEPENDENCY) continue;
    await resolveMod(dep.modId, false, modLoaderType, gameVersion, apiKey, visited, plan, skipped, onProgress);
  }
}

/** Downloads a CurseForge mod - and every *required* dependency, recursively - into modsDir. */
export async function installFromCurseForge(
  modsDir: string,
  modId: number,
  loader: Loader,
  versionId: string,
  apiKey: string,
  onProgress: (progress: CurseForgeInstallProgress) => void
): Promise<CurseForgeInstallResult> {
  const modLoaderType = modLoaderTypeFor(loader);
  if (modLoaderType === null) {
    throw new Error("This instance has no mod loader (Fabric/Forge/Quilt/NeoForge) - mods can't be installed into it.");
  }
  const gameVersion = minecraftVersionOf(versionId);
  fs.mkdirSync(modsDir, { recursive: true });

  const plan: PlannedDownload[] = [];
  const skippedDependencies: string[] = [];
  await resolveMod(modId, true, modLoaderType, gameVersion, apiKey, new Set(), plan, skippedDependencies, onProgress);

  let done = 0;
  const total = plan.length;
  for (const item of plan) {
    onProgress({ phase: "downloading", name: item.name, done, total, detail: `Downloading ${item.name} (${done + 1}/${total})...` });
    // path.basename guards against a crafted filename escaping modsDir, same as modrinth.ts.
    await downloadFile(item.url, path.join(modsDir, path.basename(item.filename)));
    done++;
  }

  onProgress({ phase: "done", name: "", done, total, detail: `Installed ${done} file${done === 1 ? "" : "s"}.` });
  return { installedFiles: plan.map((p) => path.basename(p.filename)), skippedDependencies };
}
