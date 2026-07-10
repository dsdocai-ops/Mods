// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { AppSettings, ConfigFormat, CreateInstanceInput, Instance, LaunchLogEvent, Loader, ModrinthUpdate, ModTag } from "../shared/types";
import type { CosmeticType } from "../shared/cosmetics";
import * as instances from "./instances";
import * as mods from "./mods";
import * as modrinth from "./modrinth";
import * as shaders from "./shaders";
import * as store from "./store";
import * as javaModule from "./java";
import { launchInstance, sweepStaleNativesDirs, SWITCH_ACCOUNT_MARKER_NAME } from "./launch";
import { installFabric, installForge, installVanilla, listInstallableVersions } from "./installer";
import type { InstallProgress } from "../shared/types";
import { findModConfigPath, readModConfigFile, writeModConfigFile } from "./modConfig";
import { ensureOmegaMods, hasShaderLoader, installShaderSupport } from "./bundledMods";
import { setupAutoUpdater } from "./updater";
import * as accounts from "./accountStore";
import * as licensing from "./licensing";

const isDev = process.env.NODE_ENV === "development";
const runningProcesses = new Map<string, ChildProcess>();
// Instances currently inside launchInstance()'s async setup (which can sit in a Microsoft token
// refresh for seconds) - they're not in runningProcesses yet, but a second launch:start for the
// same instance during that window would otherwise pass the has() guard and spawn a second JVM.
const pendingLaunches = new Set<string>();
// Instances a stop request was just issued for. kill() only *requests* termination (SIGTERM is
// asynchronous), but launch:stop already removes the instance from runningProcesses immediately
// so the UI can flip Stop->Play right away - which means a fast Stop-then-Play could otherwise
// pass both guards above and spawn a second JVM for the same instance while the first is still
// tearing down. Cleared by the process's own "exit" listener, or after STOP_GRACE_MS as a
// fallback in case something (a stuck child, a platform quirk) keeps exit from ever firing.
const stoppingInstances = new Set<string>();
const STOP_GRACE_MS = 5000;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Resolve from the app root (project dir in dev, app.asar when packaged), NOT relative to
    // __dirname: main.js compiles to dist-electron/main/, so a "../dist-renderer" hop landed on
    // dist-electron/dist-renderer - a path that doesn't exist. Dev mode always loads the Vite dev
    // server, so the first time this branch ever actually ran was the first packaged .exe, which
    // opened an empty window (a failed loadFile renders as a blank page).
    win.loadFile(path.join(app.getAppPath(), "dist-renderer", "index.html"));
  }

  return win;
}

/**
 * Unlike every sibling handler (`mods:*`, `shaders:*`), `modconfig:read`/`write` take a full path
 * rather than a bare filename, since findModConfigPath's return value can point at several
 * candidate file names under different subdirectories. That path is renderer-supplied and reaches
 * fs.readFileSync/writeFileSync with no containment check today - this restricts it to somewhere
 * under a known instance's own config dir, the same "don't trust a renderer-controlled path"
 * posture path.basename gives the filename-only handlers.
 */
function assertPathInsideKnownInstanceConfig(filePath: string): void {
  const resolved = path.resolve(filePath);
  const inside = instances.listInstances().some((inst) => {
    const configDir = path.resolve(path.join(path.dirname(inst.modsDir), "config"));
    return resolved === configDir || resolved.startsWith(configDir + path.sep);
  });
  if (!inside) {
    throw new Error("Refusing to access a config file outside a known instance.");
  }
}

app.whenReady().then(() => {
  // Clean up natives dirs leaked by a previous crash/hard-kill (normal exits delete their own).
  sweepStaleNativesDirs();

  // `let`, not `const`: on macOS the window can be closed while the app (and any running game
  // process) stays alive, and "activate" then creates a fresh window. Every closure below reads
  // this binding at call time, so reassigning it on activate is what keeps dialogs, log streaming,
  // and the switch-account flow pointed at the live window instead of a destroyed one.
  let win = createWindow();

  /** webContents.send on a destroyed window throws - and game stdout keeps flowing after a macOS window close. */
  function sendToRenderer(channel: string, payload: unknown) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }

  setupAutoUpdater(sendToRenderer, store.getSettings().autoUpdateEnabled);

  /** The companion mod's in-game "Switch Account" button writes this marker right before quitting - see launch.ts. */
  function checkSwitchAccountRequest(instance: Instance) {
    const runDir = path.dirname(instance.modsDir);
    const markerPath = path.join(runDir, SWITCH_ACCOUNT_MARKER_NAME);
    if (!fs.existsSync(markerPath)) return;
    try {
      fs.unlinkSync(markerPath);
    } catch {
      // Best-effort cleanup; leaving it behind just means it's ignored (already-consumed) next launch.
    }
    if (win.isDestroyed()) return;
    win.show();
    win.focus();
    win.webContents.send("launch:switchAccountRequested", instance.id);
  }

  ipcMain.handle("instances:list", () => instances.listInstances());
  ipcMain.handle("instances:create", async (_e, input: CreateInstanceInput) => {
    const instance = instances.createInstance(input);
    // Lunar-style: the Omega mod is a launcher feature, preinstalled the moment an instance exists
    // (this never throws - it logs and moves on). It pulls its own Fabric API dependency, but does
    // NOT silently install third-party shader mods (Iris/Sodium/Oculus) - those are user-initiated
    // from the Shaders tab, see installShaderSupport / the shaders:installLoader handler.
    await ensureOmegaMods(instance, (line) => console.log(line));
    return instance;
  });
  ipcMain.handle("instances:update", (_e, instance: Instance) => instances.updateInstance(instance));
  ipcMain.handle("instances:delete", (_e, id: string) => instances.removeInstance(id));
  ipcMain.handle("instances:detectVersions", (_e, gameDir: string) => instances.detectInstalledVersions(gameDir));

  ipcMain.handle("dialog:pickDirectory", async () => {
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:pickJarFiles", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Minecraft Mods", extensions: ["jar"] }],
    });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle("dialog:pickShaderFiles", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Shader Packs", extensions: ["zip"] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  // Only ever called with our own hardcoded affiliate/reference links (see shared/affiliates.ts),
  // never renderer-supplied input - restricted to https anyway so a compromised renderer couldn't
  // smuggle a file:/javascript: URI through shell.openExternal.
  ipcMain.handle("external:open", (_e, url: string) => {
    if (!url.startsWith("https://")) return false;
    shell.openExternal(url);
    return true;
  });

  ipcMain.handle("mods:list", (_e, modsDir: string) => mods.listMods(modsDir));
  ipcMain.handle("mods:import", (_e, modsDir: string, sourcePaths: string[]) => mods.importMods(modsDir, sourcePaths));
  ipcMain.handle("mods:setEnabled", (_e, modsDir: string, modId: string, enabled: boolean) =>
    mods.setModEnabled(modsDir, modId, enabled)
  );
  ipcMain.handle("mods:remove", (_e, modsDir: string, modId: string) => mods.removeMod(modsDir, modId));
  ipcMain.handle("mods:applyPreset", (_e, modsDir: string, tags: ModTag[]) => mods.applyTagPreset(modsDir, tags));
  ipcMain.handle("mods:setEnabledBulk", (_e, modsDir: string, changes: Record<string, boolean>) =>
    mods.setModsEnabledBulk(modsDir, changes)
  );

  ipcMain.handle("shaders:list", (_e, modsDir: string) => shaders.listShaderPacks(modsDir));
  ipcMain.handle("shaders:import", (_e, modsDir: string, sourcePaths: string[]) => shaders.importShaderPacks(modsDir, sourcePaths));
  ipcMain.handle("shaders:remove", (_e, modsDir: string, fileName: string) => shaders.removeShaderPack(modsDir, fileName));
  ipcMain.handle("shaders:hasLoader", (_e, instance: Instance) => hasShaderLoader(instance));
  ipcMain.handle("shaders:installLoader", (_e, instance: Instance) =>
    installShaderSupport(instance, (line) => sendToRenderer("launch:log", { instanceId: instance.id, stream: "status", data: line }))
  );

  ipcMain.handle("modconfig:find", (_e, modsDir: string, modId: string) => findModConfigPath(path.dirname(modsDir), modId));
  ipcMain.handle("modconfig:read", (_e, filePath: string) => {
    assertPathInsideKnownInstanceConfig(filePath);
    return readModConfigFile(filePath);
  });
  ipcMain.handle("modconfig:write", (_e, filePath: string, format: ConfigFormat, data: Record<string, unknown>) => {
    assertPathInsideKnownInstanceConfig(filePath);
    return writeModConfigFile(filePath, format, data);
  });

  ipcMain.handle("java:detect", (_e, gameDir?: string) => javaModule.detectJavaCandidates(gameDir));
  ipcMain.handle("java:verify", (_e, javaPath: string) => javaModule.verifyJava(javaPath));

  ipcMain.handle("licensing:redeem", (_e, key: string) => licensing.redeemLicenseKey(key));
  ipcMain.handle("licensing:listOwned", () => licensing.getOwnedCosmetics());
  ipcMain.handle("licensing:getActiveSlots", () => licensing.getActiveSlots());
  ipcMain.handle("licensing:setActiveSlot", (_e, slot: CosmeticType, cosmeticId: string) => licensing.setActiveSlot(slot, cosmeticId));

  ipcMain.handle("install:listVersions", () => listInstallableVersions());

  // One install at a time: two concurrent installs into the same gameDir would race on the same
  // files, and the single progress channel couldn't tell them apart anyway.
  let installInFlight = false;
  ipcMain.handle("install:start", async (_e, gameDir: string, versionId: string, loader: "vanilla" | "fabric" | "forge") => {
    if (installInFlight) {
      throw new Error("Another install is already running - wait for it to finish.");
    }
    installInFlight = true;
    const onProgress = (progress: InstallProgress) => sendToRenderer("install:progress", progress);
    try {
      if (loader === "fabric") {
        return await installFabric(gameDir, versionId, onProgress);
      }
      if (loader === "forge") {
        // The Forge installer is a Java program; prefer the user's configured Java, fall back to
        // whatever detection finds, then to PATH.
        const javaPath = store.getSettings().defaultJvm.javaPath || javaModule.detectJavaCandidates(gameDir)[0] || "java";
        return await installForge(gameDir, versionId, javaPath, onProgress);
      }
      await installVanilla(gameDir, versionId, onProgress);
      return versionId;
    } finally {
      installInFlight = false;
    }
  });

  ipcMain.handle("modrinth:search", (_e, query: string, loader: Loader, versionId: string) =>
    modrinth.searchModrinth(query, loader, versionId)
  );

  // One Modrinth install at a time: concurrent installs into the same modsDir could both try to
  // write the same shared dependency jar, and the single progress channel couldn't tell two
  // installs apart. (Separate from installInFlight above, which guards version installs.)
  let modrinthInstallInFlight = false;
  ipcMain.handle("modrinth:install", async (_e, modsDir: string, projectId: string, loader: Loader, versionId: string) => {
    if (modrinthInstallInFlight) {
      throw new Error("Another mod is already installing - wait for it to finish.");
    }
    modrinthInstallInFlight = true;
    try {
      return await modrinth.installFromModrinth(modsDir, projectId, loader, versionId, (progress) =>
        sendToRenderer("modrinth:installProgress", progress)
      );
    } finally {
      modrinthInstallInFlight = false;
    }
  });

  ipcMain.handle("modrinth:checkUpdates", (_e, modsDir: string, loader: Loader, versionId: string) =>
    modrinth.checkModrinthUpdates(modsDir, loader, versionId)
  );

  ipcMain.handle("modrinth:applyUpdates", async (_e, modsDir: string, updates: ModrinthUpdate[], loader: Loader, versionId: string) => {
    // Shares the single install-in-flight guard: updating and installing both write jars into the
    // same modsDir and stream over the same progress channel, so they must not overlap.
    if (modrinthInstallInFlight) {
      throw new Error("Another mod operation is already running - wait for it to finish.");
    }
    modrinthInstallInFlight = true;
    try {
      return await modrinth.applyModrinthUpdates(modsDir, updates, loader, versionId, (progress) =>
        sendToRenderer("modrinth:installProgress", progress)
      );
    } finally {
      modrinthInstallInFlight = false;
    }
  });

  ipcMain.handle("settings:get", () => store.getSettings());
  ipcMain.handle("settings:set", (_e, settings: AppSettings) => store.saveSettings(settings));

  ipcMain.handle("accounts:list", () => accounts.listAccounts());
  ipcMain.handle("accounts:addMicrosoft", async () => {
    const clientId = store.getSettings().msaClientId;
    return accounts.addMicrosoftAccount(clientId, win);
  });
  ipcMain.handle("accounts:remove", (_e, id: string) => accounts.removeAccount(id));

  ipcMain.handle("launch:start", async (_e, instance: Instance) => {
    if (runningProcesses.has(instance.id) || pendingLaunches.has(instance.id) || stoppingInstances.has(instance.id)) {
      throw new Error("This instance is already running.");
    }
    pendingLaunches.add(instance.id);
    const onLog = (event: LaunchLogEvent) => sendToRenderer("launch:log", event);
    try {
      // Keep the preinstalled Omega mod current on every launch - also self-heals a deleted jar.
      // Shader mods are deliberately NOT touched here: they're third-party and user-installed (see
      // the shaders:installLoader handler), so re-adding them behind the user's back on every launch
      // is exactly the silent behaviour we don't want.
      await ensureOmegaMods(instance, (line) => onLog({ instanceId: instance.id, stream: "status", data: line }));

      // Opt-in per instance (Instance Settings > "Automatically update mods on launch"): bring this
      // instance's Modrinth-sourced mods up to date before launching. Non-fatal - a Modrinth outage
      // or offline machine must never block the game from starting, so it logs and launches anyway.
      if (instance.autoUpdateMods) {
        try {
          const status = (line: string) => onLog({ instanceId: instance.id, stream: "status", data: line });
          const found = await modrinth.checkModrinthUpdates(instance.modsDir, instance.loader, instance.versionId);
          if (found.length > 0) {
            status(`Auto-updating ${found.length} mod${found.length === 1 ? "" : "s"} from Modrinth...`);
            await modrinth.applyModrinthUpdates(instance.modsDir, found, instance.loader, instance.versionId, (p) => status(p.detail));
          }
        } catch (err) {
          onLog({ instanceId: instance.id, stream: "status", data: `warning: mod auto-update skipped: ${err instanceof Error ? err.message : String(err)}` });
        }
      }
      const msaClientId = store.getSettings().msaClientId;
      const handle = await launchInstance(instance, msaClientId, onLog);
      runningProcesses.set(instance.id, handle.process);
      handle.process.on("exit", () => {
        runningProcesses.delete(instance.id);
        stoppingInstances.delete(instance.id);
        checkSwitchAccountRequest(instance);
      });
      instances.markLaunched(instance.id);
      return true;
    } catch (err) {
      onLog({ instanceId: instance.id, stream: "stderr", data: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      pendingLaunches.delete(instance.id);
    }
  });

  ipcMain.handle("launch:stop", (_e, instanceId: string) => {
    const proc = runningProcesses.get(instanceId);
    if (proc) {
      stoppingInstances.add(instanceId);
      proc.kill();
      runningProcesses.delete(instanceId);
      setTimeout(() => stoppingInstances.delete(instanceId), STOP_GRACE_MS);
    }
    return true;
  });

  ipcMain.handle("launch:isRunning", (_e, instanceId: string) => runningProcesses.has(instanceId));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

app.on("window-all-closed", () => {
  for (const proc of runningProcesses.values()) proc.kill();
  if (process.platform !== "darwin") app.quit();
});
