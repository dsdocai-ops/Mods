// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import type { AppSettings, Instance } from "../shared/types";
import * as store from "./store";

/**
 * Keeps in-game settings - options.txt, which Minecraft itself uses for FOV, render distance,
 * graphics/sound options, key binds, language, everything the client persists there - in sync
 * across instances that opt in (Instance.syncGameSettings, falling back to
 * AppSettings.syncGameSettingsAcrossInstances). There's no live hook into the running game to
 * catch an in-session settings change, so syncing happens at the two natural checkpoints around a
 * play session instead: pull the group's latest options.txt right before launch, push this
 * instance's (possibly just-edited) copy out to the rest of the group right after it exits.
 */

const OPTIONS_FILENAME = "options.txt";

function optionsPath(instance: Instance): string {
  return path.join(instance.gameDir, OPTIONS_FILENAME);
}

function isSynced(instance: Instance, settings: AppSettings): boolean {
  return instance.syncGameSettings ?? settings.syncGameSettingsAcrossInstances;
}

/**
 * Before launch: if this instance is synced, copies in whichever synced instance's options.txt was
 * modified most recently, so the session starts with the rest of the group's current settings. A
 * no-op if this instance isn't synced, no other synced instance has an options.txt yet, or the
 * newest one happens to already be this instance's own file (same gameDir shared by two instances).
 */
export function pullBeforeLaunch(instance: Instance): void {
  const settings = store.getSettings();
  if (!isSynced(instance, settings)) return;

  let newestPath: string | null = null;
  let newestMtimeMs = -Infinity;
  for (const other of store.getInstances()) {
    if (other.id === instance.id || !isSynced(other, settings)) continue;
    const candidate = optionsPath(other);
    const stat = fs.existsSync(candidate) ? fs.statSync(candidate) : null;
    if (stat && stat.mtimeMs > newestMtimeMs) {
      newestMtimeMs = stat.mtimeMs;
      newestPath = candidate;
    }
  }
  if (!newestPath) return;

  const target = optionsPath(instance);
  if (path.resolve(newestPath) === path.resolve(target)) return;
  fs.mkdirSync(instance.gameDir, { recursive: true });
  fs.copyFileSync(newestPath, target);
}

/**
 * After the game process exits: if this instance is synced, pushes its options.txt out to every
 * other synced instance's gameDir, so the rest of the group has the update without waiting for
 * their own next launch to pull it.
 */
export function pushAfterExit(instance: Instance): void {
  const settings = store.getSettings();
  if (!isSynced(instance, settings)) return;

  const source = optionsPath(instance);
  if (!fs.existsSync(source)) return;

  for (const other of store.getInstances()) {
    if (other.id === instance.id || !isSynced(other, settings)) continue;
    const target = optionsPath(other);
    if (path.resolve(source) === path.resolve(target)) continue;
    fs.mkdirSync(other.gameDir, { recursive: true });
    fs.copyFileSync(source, target);
  }
}
