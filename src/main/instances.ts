// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CreateInstanceInput, DetectedVersion, Instance, Loader } from "../shared/types";
import { DEFAULT_JVM } from "../shared/types";
import * as store from "./store";

// Monochrome: distinct mid-tone grays instead of a rainbow, so each instance is still visually
// distinguishable in the sidebar without breaking the black-and-white theme.
const ICON_COLORS = ["#3a3a40", "#48484f", "#565660", "#2f2f35", "#606069", "#404048"];

/**
 * A version id like "1.20.1-forge-47.2.0" or a fabric-loader id embeds the loader name;
 * fall back to inspecting the libraries list for loader-specific maven groups.
 */
function detectLoaderFromVersionJson(json: any, versionId: string): Loader {
  const idLower = versionId.toLowerCase();
  if (idLower.includes("fabric")) return "fabric";
  if (idLower.includes("quilt")) return "quilt";
  if (idLower.includes("neoforge")) return "neoforge";
  if (idLower.includes("forge")) return "forge";

  const libs: any[] = json.libraries ?? [];
  const libNames: string = libs.map((l) => l.name ?? "").join(" ").toLowerCase();
  if (libNames.includes("net.fabricmc")) return "fabric";
  if (libNames.includes("org.quiltmc")) return "quilt";
  if (libNames.includes("net.neoforged")) return "neoforge";
  if (libNames.includes("net.minecraftforge") || libNames.includes("minecraftforge")) return "forge";

  return "vanilla";
}

/** Scan `<gameDir>/versions/*` for installed version JSONs (works with any vanilla-launcher-compatible dir: official launcher, MultiMC/Prism instance, PolyMC, etc.). */
export function detectInstalledVersions(gameDir: string): DetectedVersion[] {
  const versionsDir = path.join(gameDir, "versions");
  if (!fs.existsSync(versionsDir)) return [];

  const results: DetectedVersion[] = [];
  for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const versionId = entry.name;
    const jsonPath = path.join(versionsDir, versionId, `${versionId}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const loader = detectLoaderFromVersionJson(json, versionId);
      results.push({ versionId, loader, jsonPath });
    } catch {
      // Skip unreadable/corrupt version json rather than failing the whole scan.
    }
  }
  return results;
}

export function listInstances(): Instance[] {
  return store.getInstances().sort((a, b) => b.createdAt - a.createdAt);
}

export function createInstance(input: CreateInstanceInput): Instance {
  const settings = store.getSettings();
  const modsDir = input.modsDir?.trim() || path.join(input.gameDir, "mods");
  fs.mkdirSync(modsDir, { recursive: true });

  const instance: Instance = {
    id: crypto.randomUUID(),
    name: input.name.trim() || input.versionId,
    gameDir: input.gameDir,
    versionId: input.versionId,
    loader: input.loader,
    modsDir,
    offlineUsername: settings.defaultOfflineUsername,
    autoUpdateMods: false,
    jvm: { ...settings.defaultJvm },
    window: { width: 1280, height: 720, fullscreen: false },
    createdAt: Date.now(),
    lastPlayedAt: null,
    iconColor: ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
  };
  return store.saveInstance(instance);
}

/**
 * Saves an instance and, if it just switched accounts, mirrors the new account onto every other
 * instance that's opted into account syncing (Instance.syncAccount, falling back to
 * AppSettings.syncAccountAcrossInstances for instances that don't set it) - so switching the
 * account anywhere keeps every synced instance pointed at the same one.
 */
export function updateInstance(instance: Instance): Instance {
  const settings = store.getSettings();
  const previous = store.getInstances().find((i) => i.id === instance.id);
  const saved = store.saveInstance(instance);

  const changingInstanceSyncs = instance.syncAccount ?? settings.syncAccountAcrossInstances;
  if (changingInstanceSyncs && instance.accountId !== previous?.accountId) {
    for (const other of store.getInstances()) {
      if (other.id === instance.id) continue;
      const otherSyncs = other.syncAccount ?? settings.syncAccountAcrossInstances;
      if (!otherSyncs || other.accountId === instance.accountId) continue;
      store.saveInstance({ ...other, accountId: instance.accountId });
    }
  }
  return saved;
}

export function removeInstance(id: string): void {
  store.deleteInstance(id);
}

export function markLaunched(id: string): void {
  const inst = store.getInstances().find((i) => i.id === id);
  if (!inst) return;
  inst.lastPlayedAt = Date.now();
  store.saveInstance(inst);
}

export { DEFAULT_JVM };
