// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import path from "node:path";
import type { DiscoveredMod, DiscoveredModPage, Instance, ModInfo } from "../shared/types";
import { downloadToCache, hasModLike, MODRINTH_HEADERS, placeJar } from "./bundledMods";
import { fetchWithRetry } from "./installer";
import { listMods } from "./mods";
import { resolveVersion } from "./versionResolver";

/**
 * In-launcher mod discovery, backed by Modrinth's search API. Two entry points:
 *
 *  - searchDiscoveryMods: powers the Mods tab's Discover view. An *empty* query is the important
 *    case - it returns the most-downloaded mods compatible with the instance's Minecraft version
 *    and loader, so the view is populated the moment it opens instead of sitting blank until the
 *    user already knows a mod name to look up.
 *  - installDiscoveredMod: downloads the latest compatible build of a picked project into the
 *    instance's mods folder, plus any *required* dependencies it declares that aren't already
 *    present (e.g. a HUD mod pulling in its config library), then returns the refreshed mod list.
 *
 * Every result is pre-filtered to the instance's version + loader, so "Install" can't hand the
 * user a jar the instance can't load.
 */

const MODRINTH_API = "https://api.modrinth.com/v2";
const PAGE_SIZE = 30;
// Modrinth search hits mix loaders into `categories`; those are facet noise next to real
// categories like "optimization" or "utility", so they're stripped before display.
const LOADER_CATEGORY_NOISE = new Set(["fabric", "forge", "quilt", "neoforge", "liteloader", "modloader", "rift"]);
// Required deps can declare their own required deps (config libs pulling in a core lib); a couple
// of hops covers real chains while a malformed/circular graph can't recurse forever.
const MAX_DEPENDENCY_DEPTH = 3;

interface DiscoveryTarget {
  loader: "fabric" | "forge";
  minecraftVersion: string;
}

/**
 * What to ask Modrinth for on this instance's behalf. Quilt loads Fabric mods (same mapping
 * bundledMods.ts uses for the Omega jar); vanilla and neoforge have nothing to discover.
 */
function discoveryTarget(instance: Instance): DiscoveryTarget {
  const loader =
    instance.loader === "fabric" || instance.loader === "quilt" ? "fabric" : instance.loader === "forge" ? "forge" : null;
  if (!loader) {
    throw new Error("Mod discovery is available for Fabric, Quilt, and Forge instances only.");
  }

  let minecraftVersion: string | undefined;
  try {
    // The vanilla root of the version chain is the real MC version (e.g. "1.20.1"), even when the
    // instance's own version id is a fabric-loader/forge profile - same trick bundledMods.ts uses.
    const resolved = resolveVersion(instance.gameDir, instance.versionId);
    minecraftVersion = resolved.chainIds[resolved.chainIds.length - 1];
  } catch {
    // Version json not readable (not installed yet, moved dir): fall back to the version number
    // embedded in ids like "fabric-loader-0.15.11-1.20.1" - the MC version is always the last one.
    minecraftVersion = instance.versionId.match(/\d+\.\d+(?:\.\d+)?/g)?.pop();
  }
  if (!minecraftVersion) {
    throw new Error(`Couldn't determine the Minecraft version behind "${instance.versionId}".`);
  }
  return { loader, minecraftVersion };
}

export async function searchDiscoveryMods(instance: Instance, query: string, offset = 0): Promise<DiscoveredModPage> {
  const { loader, minecraftVersion } = discoveryTarget(instance);
  const facets = JSON.stringify([["project_type:mod"], [`categories:${loader}`], [`versions:${minecraftVersion}`]]);
  // No query = the default discovery feed: most-downloaded compatible mods. With a query, let
  // Modrinth rank by relevance instead.
  const index = query.trim() ? "relevance" : "downloads";
  const safeOffset = Math.max(0, Math.floor(offset));
  const url = `${MODRINTH_API}/search?query=${encodeURIComponent(query.trim())}&facets=${encodeURIComponent(
    facets
  )}&index=${index}&limit=${PAGE_SIZE}&offset=${safeOffset}`;

  const response = await fetchWithRetry(url, MODRINTH_HEADERS);
  if (!response.ok) {
    throw new Error(`Modrinth search failed (${response.status})`);
  }
  const body = (await response.json()) as { hits?: any[]; total_hits?: number };

  const hits = (body.hits ?? []).map((hit): DiscoveredMod => ({
    projectId: String(hit.project_id),
    slug: String(hit.slug ?? hit.project_id),
    title: String(hit.title ?? hit.slug ?? "Unknown mod"),
    description: typeof hit.description === "string" ? hit.description : "",
    author: typeof hit.author === "string" ? hit.author : "",
    downloads: Number(hit.downloads ?? 0),
    iconUrl: typeof hit.icon_url === "string" && hit.icon_url ? hit.icon_url : null,
    categories: Array.isArray(hit.categories)
      ? hit.categories.filter((c: unknown): c is string => typeof c === "string" && !LOADER_CATEGORY_NOISE.has(c))
      : [],
  }));

  return { hits, totalHits: Number(body.total_hits ?? safeOffset + hits.length), offset: safeOffset };
}

interface ModrinthVersion {
  version_type?: string;
  files: { url: string; filename: string; primary?: boolean }[];
  dependencies?: { project_id?: string | null; dependency_type?: string }[];
}

/**
 * Latest release of a project compatible with the target MC version + loader. Same picking rule as
 * bundledMods.ts' modrinthLatestUrl, but returns the whole version object - install needs the
 * `dependencies` list too, not just the file URL.
 */
async function latestCompatibleVersion(
  projectId: string,
  minecraftVersion: string,
  loader: "fabric" | "forge"
): Promise<ModrinthVersion> {
  const url = `${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?game_versions=${encodeURIComponent(
    JSON.stringify([minecraftVersion])
  )}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
  const response = await fetchWithRetry(url, MODRINTH_HEADERS);
  if (!response.ok) {
    throw new Error(`Modrinth version lookup failed (${response.status})`);
  }
  const versions = (await response.json()) as ModrinthVersion[];
  const release = versions.find((v) => v.version_type === "release") ?? versions[0];
  if (!release) {
    throw new Error(`No compatible build for Minecraft ${minecraftVersion} (${loader}).`);
  }
  return release;
}

/** A dependency arrives as a bare project id; its slug is what filenames can be matched against. */
async function fetchProjectSlug(projectId: string): Promise<string> {
  const response = await fetchWithRetry(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}`, MODRINTH_HEADERS);
  if (!response.ok) {
    throw new Error(`Modrinth project lookup failed (${response.status})`);
  }
  const project = (await response.json()) as { slug?: string };
  return project.slug ?? projectId;
}

async function installProject(
  modsDir: string,
  projectId: string,
  minecraftVersion: string,
  loader: "fabric" | "forge",
  visited: Set<string>,
  depth: number
): Promise<void> {
  if (visited.has(projectId)) return;
  visited.add(projectId);

  const version = await latestCompatibleVersion(projectId, minecraftVersion, loader);
  const file = version.files.find((f) => f.primary) ?? version.files[0];
  if (!file) {
    throw new Error("The chosen build has no downloadable file.");
  }
  // path.basename on the API-supplied filename keeps a compromised/MITM'd response from writing
  // outside the cache or mods dir - same guard as bundledMods.ts.
  const cached = await downloadToCache(file.url, path.basename(file.filename));
  placeJar(cached, modsDir, file.filename);

  if (depth >= MAX_DEPENDENCY_DEPTH) return;
  for (const dep of version.dependencies ?? []) {
    if (dep.dependency_type !== "required" || !dep.project_id || visited.has(dep.project_id)) continue;
    try {
      const slug = await fetchProjectSlug(dep.project_id);
      // Already present (bundled, imported, or from an earlier install)? Don't fetch a duplicate.
      if (hasModLike(modsDir, slug.toLowerCase())) continue;
      await installProject(modsDir, dep.project_id, minecraftVersion, loader, visited, depth + 1);
    } catch (err) {
      // The mod itself installed fine; a dependency hiccup shouldn't roll that back. Worst case
      // the game reports the missing dep by name at launch and the user installs it directly.
      console.warn(
        `[discovery] couldn't install a required dependency of ${projectId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/** Installs a discovered project (+ its required deps) into the instance and returns the fresh mod list. */
export async function installDiscoveredMod(instance: Instance, projectId: string): Promise<ModInfo[]> {
  const { loader, minecraftVersion } = discoveryTarget(instance);
  await installProject(instance.modsDir, projectId, minecraftVersion, loader, new Set(), 0);
  return listMods(instance.modsDir);
}
