export type Loader = "vanilla" | "forge" | "fabric" | "quilt" | "neoforge";

export type ModTag =
  | "performance"
  | "pvp"
  | "utility"
  | "visual"
  | "library"
  | "hud"
  | "other";

export interface ModInfo {
  /** Stable id derived from the enabled file name (without .disabled suffix). */
  id: string;
  /** File name as it currently sits on disk, e.g. "sodium-fabric-0.5.jar" or "sodium-fabric-0.5.jar.disabled". */
  fileName: string;
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

export const MOD_TAG_PRESETS: Record<string, { label: string; tags: ModTag[] }> = {
  "smooth-pvp": {
    label: "Smooth PvP Preset",
    tags: ["performance", "pvp"],
  },
  "visual-only": {
    label: "Visual/HUD Only",
    tags: ["visual", "hud"],
  },
};
