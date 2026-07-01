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
  jvm: JvmSettings;
  window: WindowSettings;
  createdAt: number;
  lastPlayedAt: number | null;
  iconColor: string;
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

export interface LaunchLogEvent {
  instanceId: string;
  stream: "stdout" | "stderr" | "status" | "exit";
  data: string;
}

export interface AppSettings {
  defaultJvm: JvmSettings;
  defaultOfflineUsername: string;
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
