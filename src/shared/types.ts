// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
export type Loader = "vanilla" | "forge" | "fabric" | "quilt" | "neoforge";

export type ModTag =
  | "performance"
  | "pvp"
  | "utility"
  | "visual"
  | "library"
  | "hud"
  | "cpvp"
  | "uhc"
  | "bedwars"
  | "survival"
  | "other";

export interface ModInfo {
  /** Stable id derived from the enabled file name (without .disabled suffix). Used for toggle/remove operations. */
  id: string;
  /** File name as it currently sits on disk, e.g. "sodium-fabric-0.5.jar" or "sodium-fabric-0.5.jar.disabled". */
  fileName: string;
  /** The mod's own internal id read from its manifest (e.g. "sodium"), used to locate its config file. */
  modId: string;
  name: string;
  version: string;
  description: string;
  loader: Loader | "unknown";
  enabled: boolean;
  tags: ModTag[];
  sizeBytes: number;
  importedAt: number;
}

/**
 * A `.zip` shaderpack sitting in an instance's `shaderpacks/` folder. Unlike ModInfo there's no
 * `enabled` flag - Iris/Oculus pick the one active pack via their own in-game Video Settings
 * screen, not a launcher toggle - so this is just enough to render an import/remove list.
 */
export interface ShaderPackInfo {
  fileName: string;
  sizeBytes: number;
  importedAt: number;
}

export interface JvmSettings {
  javaPath: string;
  minRamMb: number;
  maxRamMb: number;
  extraArgs: string;
  /** Apply the launcher's low-latency G1GC preset tuned for smooth PvP frame pacing. */
  useSmoothPvpFlags: boolean;
}

export interface WindowSettings {
  width: number;
  height: number;
  fullscreen: boolean;
}

export interface Instance {
  id: string;
  name: string;
  /** Root game directory containing versions/, libraries/, assets/ (a vanilla-launcher-style dir the user already has installed). */
  gameDir: string;
  /** Version id as found under gameDir/versions/<versionId>/<versionId>.json */
  versionId: string;
  loader: Loader;
  /** Per-instance mods folder. Defaults to gameDir/mods but can be isolated per instance. */
  modsDir: string;
  offlineUsername: string;
  /** If set, launch with this signed-in Microsoft/Minecraft account instead of an offline session. */
  accountId?: string;
  /**
   * When true, this instance's Modrinth-sourced mods are checked for newer builds and updated right
   * before it launches. Off by default and opt-in per instance - auto-changing mods before a launch
   * is exactly the kind of surprise a competitive/frozen setup doesn't want. Optional so instances
   * saved before this field existed read as "off". See main.ts's launch:start handler.
   */
  autoUpdateMods?: boolean;
  /**
   * Chosen banner-art theme id (see shared/banners.ts). Absent = "auto": the id hash picks one of the
   * four historical hero.jpg variants, so instances saved before this field existed look unchanged
   * until the user picks a theme in the Instance Settings tab. Optional and free-form so an unknown
   * value simply falls back to auto rather than failing to load.
   */
  banner?: string;
  jvm: JvmSettings;
  window: WindowSettings;
  createdAt: number;
  lastPlayedAt: number | null;
  iconColor: string;
}

/**
 * A linked Microsoft/Minecraft account, as exposed to the renderer. Refresh/access tokens never
 * leave the main process - see accountStore.ts, where they're encrypted at rest via Electron's
 * safeStorage and kept out of anything sent over IPC.
 */
export interface PublicAccount {
  id: string;
  // "offline" is TEMPORARY, for testing the launcher while Microsoft sign-in is blocked on
  // Mojang's client-ID approval - remove it (and its accountStore/SignInRequired plumbing)
  // once real sign-in works.
  type: "microsoft" | "offline";
  username: string;
  uuid: string;
  addedAt: number;
}

export type ConfigFormat = "json" | "toml";

export interface ModConfigFile {
  path: string;
  format: ConfigFormat;
  data: Record<string, unknown>;
}

export interface CreateInstanceInput {
  name: string;
  gameDir: string;
  versionId: string;
  loader: Loader;
  modsDir?: string;
}

export interface DetectedVersion {
  versionId: string;
  loader: Loader;
  jsonPath: string;
}

/** A Minecraft release the installer can download, from Mojang's version manifest. */
export interface InstallableVersion {
  id: string;
  type: string;
  releaseTime: string;
}

/** Progress events streamed while the installer downloads a version - see main/installer.ts. */
export interface InstallProgress {
  phase: "manifest" | "version-json" | "client-jar" | "libraries" | "assets" | "fabric-profile" | "forge-installer";
  done: number;
  total: number;
  detail: string;
}

/**
 * One search result from Modrinth's `/v2/search` endpoint (the in-launcher "Discover" browser),
 * flattened to just what a result card needs. `projectId`/`slug` identify the project for the
 * follow-up install call.
 */
export interface ModrinthSearchHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string;
  categories: string[];
}

/**
 * Progress streamed while a Modrinth project (and its required dependencies) is resolved and
 * downloaded into an instance's modsDir - see main/modrinth.ts. Mirrors InstallProgress's shape so
 * the renderer can drive the same kind of little progress line.
 */
export interface ModrinthInstallProgress {
  phase: "resolving" | "downloading" | "done";
  /** Human-readable name of whatever is being handled right now (the mod or a dependency). */
  name: string;
  done: number;
  total: number;
  detail: string;
}

/** What a completed Modrinth install returns: the jar file names written into modsDir (mod + any auto-installed required deps). */
export interface ModrinthInstallResult {
  installedFiles: string[];
  /** Required dependencies that had no build matching this instance's loader/version and were skipped - surfaced as a warning. */
  skippedDependencies: string[];
}

/**
 * One installed jar that Modrinth has a newer compatible build for - found by hashing the jars in
 * modsDir and asking Modrinth's `/version_files/update` endpoint (no local provenance tracking
 * needed). The trailing fields are opaque download details the renderer just hands back to
 * modrinth:applyUpdates; only `fileName`/`newVersion` are meant for display.
 */
export interface ModrinthUpdate {
  /** Current on-disk file name, including a `.disabled` suffix if the mod is currently disabled. */
  fileName: string;
  /** The newer version number available on Modrinth (e.g. "0.6.0"). */
  newVersion: string;
  projectId: string;
  url: string;
  newFileName: string;
  sha1: string;
  enabled: boolean;
}

/**
 * One search result from CurseForge's `/v1/mods/search` endpoint (the "CurseForge" Discover
 * segment), flattened the same way ModrinthSearchHit is. `modId` identifies the mod for the
 * follow-up install call - see main/curseforge.ts.
 */
export interface CurseForgeSearchHit {
  modId: number;
  slug: string;
  name: string;
  summary: string;
  author: string;
  downloads: number;
  iconUrl: string;
  categories: string[];
}

/** Progress streamed while a CurseForge mod (and its required dependencies) is downloaded into an instance's modsDir - see main/curseforge.ts. Mirrors ModrinthInstallProgress's shape. */
export interface CurseForgeInstallProgress {
  phase: "resolving" | "downloading" | "done";
  name: string;
  done: number;
  total: number;
  detail: string;
}

/** What a completed CurseForge install returns - mirrors ModrinthInstallResult. */
export interface CurseForgeInstallResult {
  installedFiles: string[];
  skippedDependencies: string[];
}

/**
 * One entry in the "Featured Mods" Discover segment - Omega's own curated picks, as opposed to the
 * CurseForge segment's live API search. `status: "coming-soon"` marks a mod that's been announced
 * but has no build yet, so the card shows a disabled placeholder instead of an install button and
 * `downloadUrl` is omitted. See main/featuredMods.ts.
 */
export interface FeaturedMod {
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl: string;
  tags: ModTag[];
  status: "available" | "coming-soon";
  /** Direct download URL for the jar, present only when status is "available". */
  downloadUrl?: string;
}

export interface LaunchLogEvent {
  instanceId: string;
  /**
   * "crash" is synthesized by main.ts (not launch.ts) when the game process exits abnormally
   * within EARLY_EXIT_THRESHOLD_MS of spawning - the Play button flipping to "running" only means
   * the JVM started, not that a window ever opened, so a fast non-zero exit otherwise looks like
   * "launched but nothing happened" with no explanation. See main.ts's launch:start handler.
   */
  stream: "stdout" | "stderr" | "status" | "exit" | "crash";
  data: string;
}

export interface AppSettings {
  defaultJvm: JvmSettings;
  defaultOfflineUsername: string;
  /** Azure AD "Application (client) ID" for Microsoft sign-in - see README for how to register one. Empty until you provide your own. */
  msaClientId: string;
  /** Background-check the rolling release for a newer build on startup and download it silently. On by default; portable installs ignore this (they can't self-update either way). */
  autoUpdateEnabled: boolean;
  /** Show the "mods are downloaded from the internet" disclaimer in the Discover browser. On by default; the disclaimer's "Don't show again" button and a Settings toggle both flip this. */
  showModDownloadWarning: boolean;
  /** Show a "Playing Omega Client" Discord Rich Presence status while an instance is running, via Omega Client's own shared Discord application (see main/discordPresence.ts) - no sign-in or setup involved, just an opt-out. On by default. */
  discordRichPresenceEnabled: boolean;
  /** Personal API key from console.curseforge.com, required to search/install from the CurseForge Discover segment - see main/curseforge.ts. Empty until the user provides their own; CurseForge doesn't offer a shared default like Modrinth's keyless API. */
  curseforgeApiKey: string;
  /** Play the "Ignition" launch-transition overlay and "Afterglow" session-end overlay in App.tsx. On by default; for players who want zero friction between click and game, an opt-out. */
  launchAnimationsEnabled: boolean;
}

/**
 * Result of redeeming a license key for a paid cosmetic - see main/licensing.ts. `cosmeticId`
 * matches an id in the mod's CosmeticCatalog (mod/common/.../presence/CosmeticCatalog.java).
 */
export interface RedeemLicenseResult {
  ok: boolean;
  cosmeticId?: string;
  message: string;
}

/**
 * A native, in-launcher sponsor/affiliate recommendation - not a third-party ad network banner (see
 * README's Monetization section for why). Always paired with an explicit disclosure per FTC-style
 * rules and Minecraft's own usage guidelines around not implying endorsement.
 */
export interface SponsorPlacement {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  url: string;
  disclosure: string;
}

export const DEFAULT_JVM: JvmSettings = {
  javaPath: "",
  minRamMb: 2048,
  maxRamMb: 4096,
  extraArgs: "",
  useSmoothPvpFlags: true,
};

/**
 * Preset buttons in the Mods tab. Each one bulk-enables every imported mod carrying any of its
 * tags and disables the rest - the launcher never bundles mods itself (see README), so a preset
 * is only as good as the auto-tagging in modMetadata.ts recognizing the mods you've imported.
 */
export const MOD_TAG_PRESETS: Record<string, { label: string; description: string; tags: ModTag[] }> = {
  "smooth-pvp": {
    label: "Smooth PvP",
    description: "Performance + general combat mods.",
    tags: ["performance", "pvp"],
  },
  cpvp: {
    label: "Crystal PvP",
    description: "Performance + crystal/totem/anchor combat mods.",
    tags: ["performance", "pvp", "cpvp"],
  },
  uhc: {
    label: "UHC",
    description: "Performance + UHC-specific utility mods (timers, health indicators, etc.).",
    tags: ["performance", "uhc"],
  },
  bedwars: {
    label: "Bedwars",
    description: "Performance + Bedwars-specific utility mods.",
    tags: ["performance", "bedwars"],
  },
  survival: {
    label: "Survival",
    description: "Performance + general survival QoL mods (maps, storage, crafting helpers).",
    tags: ["performance", "survival"],
  },
  "visual-only": {
    label: "Visual/HUD Only",
    description: "Just visual and HUD mods, everything else off.",
    tags: ["visual", "hud"],
  },
};
