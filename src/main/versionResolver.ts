import fs from "node:fs";
import path from "node:path";

interface OsRule {
  name?: "windows" | "osx" | "linux";
  arch?: string;
}

interface Rule {
  action: "allow" | "disallow";
  os?: OsRule;
  features?: Record<string, boolean>;
}

interface LibraryDownloadArtifact {
  path?: string;
  url?: string;
  sha1?: string;
  size?: number;
}

export interface LibraryEntry {
  name: string;
  rules?: Rule[];
  natives?: Record<string, string>;
  extract?: { exclude?: string[] };
  downloads?: {
    artifact?: LibraryDownloadArtifact;
    classifiers?: Record<string, LibraryDownloadArtifact>;
  };
  url?: string;
}

type ArgToken = string | { rules: Rule[]; value: string | string[] };

interface RawVersionJson {
  id: string;
  inheritsFrom?: string;
  mainClass?: string;
  type?: string;
  libraries?: LibraryEntry[];
  arguments?: { game?: ArgToken[]; jvm?: ArgToken[] };
  minecraftArguments?: string;
  assetIndex?: { id: string };
  assets?: string;
}

export interface ResolvedVersion {
  id: string;
  mainClass: string;
  type: string;
  libraries: LibraryEntry[];
  gameArgTokens: ArgToken[];
  jvmArgTokens: ArgToken[];
  assetIndexId: string;
  /** Ids from leaf to root, used to locate the actual client .jar on disk. */
  chainIds: string[];
}

function currentOsName(): "windows" | "osx" | "linux" {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "osx";
  return "linux";
}

export function rulesAllow(rules: Rule[] | undefined, features: Record<string, boolean>): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os?.name && rule.os.name !== currentOsName()) matches = false;
    if (rule.os?.arch && rule.os.arch !== process.arch) matches = false;
    if (rule.features) {
      for (const [key, expected] of Object.entries(rule.features)) {
        if (Boolean(features[key]) !== expected) matches = false;
      }
    }
    if (matches) allowed = rule.action === "allow";
  }
  return allowed;
}

/**
 * Strips any ".."/"."/empty path segment out of a library-relative path before it's ever joined
 * against the shared libraries/ root. Every caller that builds a download destination or a
 * classpath/natives-extraction source from a library path (installer.ts, launch.ts) runs its
 * result through this - the path can come from two untrusted places: mavenNameToPath below (only
 * sanitizes the group segment, so a crafted coordinate like "com.example:..:..:1.0" still leaves
 * literal ".." in the artifact/version segments) or a version JSON's own "path" field, read
 * verbatim (nothing here verifies the JSON's authenticity, only the downloaded *bytes* are
 * sha1-checked - and a user can point gameDir at any directory, including a hand-crafted or
 * imported third-party modpack's).
 */
export function safeLibraryPath(relPath: string): string {
  return relPath
    .split(/[\\/]/)
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

/** Converts a Maven coordinate like "net.fabricmc:fabric-loader:0.15.7" (optionally with a classifier) into its repo-relative jar path. */
export function mavenNameToPath(name: string): string {
  const [group, artifact, version, classifier] = name.split(":");
  const groupPath = group.replace(/\./g, "/");
  const fileName = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
  return safeLibraryPath(`${groupPath}/${artifact}/${version}/${fileName}`);
}

function loadVersionJson(gameDir: string, versionId: string): RawVersionJson {
  const jsonPath = path.join(gameDir, "versions", versionId, `${versionId}.json`);
  return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
}

/** Follows `inheritsFrom` (Forge/Fabric/Quilt version jsons inherit from a vanilla base) and merges libraries + arguments. */
export function resolveVersion(gameDir: string, versionId: string): ResolvedVersion {
  const chain: RawVersionJson[] = [];
  const chainIds: string[] = [];
  let currentId: string | undefined = versionId;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const json = loadVersionJson(gameDir, currentId);
    chain.push(json);
    chainIds.push(currentId);
    currentId = json.inheritsFrom;
  }

  // chain[0] is the leaf (most specific, e.g. the Forge/Fabric profile); last is the vanilla root.
  const leaf = chain[0];
  const root = chain[chain.length - 1];

  const libraryMap = new Map<string, LibraryEntry>();
  for (let i = chain.length - 1; i >= 0; i--) {
    for (const lib of chain[i].libraries ?? []) {
      const key = lib.name.split(":").slice(0, 2).join(":");
      libraryMap.set(key, lib);
    }
  }

  const gameArgTokens: ArgToken[] = [];
  const jvmArgTokens: ArgToken[] = [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const args = chain[i].arguments;
    if (args?.game) gameArgTokens.push(...args.game);
    if (args?.jvm) jvmArgTokens.push(...args.jvm);
  }

  if (jvmArgTokens.length === 0) {
    // Legacy (pre-1.13) versions have no `arguments.jvm` block; synthesize Mojang's implicit default.
    jvmArgTokens.push("-Djava.library.path=${natives_directory}", "-cp", "${classpath}");
  }

  if (gameArgTokens.length === 0) {
    const legacy = chain.find((j) => j.minecraftArguments)?.minecraftArguments;
    if (legacy) gameArgTokens.push(...legacy.split(/\s+/).filter(Boolean));
  }

  const mainClass = chain.find((j) => j.mainClass)?.mainClass;
  if (!mainClass) throw new Error(`No mainClass found in version chain for "${versionId}"`);

  const assetIndexId = leaf.assetIndex?.id ?? leaf.assets ?? root.assetIndex?.id ?? root.assets ?? "legacy";

  return {
    id: leaf.id ?? versionId,
    mainClass,
    type: leaf.type ?? root.type ?? "release",
    libraries: [...libraryMap.values()],
    gameArgTokens,
    jvmArgTokens,
    assetIndexId,
    chainIds,
  };
}

/** The vanilla client .jar only ever gets physically downloaded into the root (vanilla) version's own folder. */
export function findClientJar(gameDir: string, chainIds: string[]): string | null {
  for (const id of chainIds) {
    const candidate = path.join(gameDir, "versions", id, `${id}.jar`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function substitutePlaceholders(token: string, values: Record<string, string>): string {
  return token.replace(/\$\{([a-zA-Z_]+)\}/g, (match, key) => (key in values ? values[key] : match));
}

export function resolveArgTokens(tokens: ArgToken[], features: Record<string, boolean>, values: Record<string, string>): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (typeof token === "string") {
      out.push(substitutePlaceholders(token, values));
      continue;
    }
    if (!rulesAllow(token.rules, features)) continue;
    const vals = Array.isArray(token.value) ? token.value : [token.value];
    for (const v of vals) out.push(substitutePlaceholders(v, values));
  }
  return out;
}

export { rulesAllow as evaluateRules };
export type { Rule, ArgToken };
