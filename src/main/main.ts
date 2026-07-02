import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { AppSettings, ConfigFormat, CreateInstanceInput, Instance, LaunchLogEvent, ModTag } from "../shared/types";
import * as instances from "./instances";
import * as mods from "./mods";
import * as store from "./store";
import * as javaModule from "./java";
import { launchInstance, sweepStaleNativesDirs, SWITCH_ACCOUNT_MARKER_NAME } from "./launch";
import { installFabric, installForge, installVanilla, listInstallableVersions } from "./installer";
import type { InstallProgress } from "../shared/types";
import { ensureOmegaConfig, findModConfigPath, readModConfigFile, writeModConfigFile } from "./modConfig";
import { ensureOmegaMods } from "./bundledMods";
import { setupAutoUpdater } from "./updater";
import * as accounts from "./accountStore";

const isDev = process.env.NODE_ENV === "development";
const runningProcesses = new Map<string, ChildProcess>();
// Instances currently inside launchInstance()'s async setup (which can sit in a Microsoft token
// refresh for seconds) - they're not in runningProcesses yet, but a second launch:start for the
// same instance during that window would otherwise pass the has() guard and spawn a second JVM.
const pendingLaunches = new Set<string>();

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

  setupAutoUpdater(sendToRenderer);

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
    // Lunar-style: the Omega mod is a launcher feature, preinstalled the moment an instance
    // exists. ensureOmegaMods never throws (logs and moves on), so creation can't fail on network.
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

  ipcMain.handle("modconfig:find", (_e, modsDir: string, modId: string) => findModConfigPath(path.dirname(modsDir), modId));
  ipcMain.handle("modconfig:ensureOmega", (_e, modsDir: string) => ensureOmegaConfig(path.dirname(modsDir)));
  ipcMain.handle("modconfig:read", (_e, filePath: string) => readModConfigFile(filePath));
  ipcMain.handle("modconfig:write", (_e, filePath: string, format: ConfigFormat, data: Record<string, unknown>) =>
    writeModConfigFile(filePath, format, data)
  );

  ipcMain.handle("java:detect", (_e, gameDir?: string) => javaModule.detectJavaCandidates(gameDir));
  ipcMain.handle("java:verify", (_e, javaPath: string) => javaModule.verifyJava(javaPath));

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

  ipcMain.handle("settings:get", () => store.getSettings());
  ipcMain.handle("settings:set", (_e, settings: AppSettings) => store.saveSettings(settings));

  ipcMain.handle("accounts:list", () => accounts.listAccounts());
  ipcMain.handle("accounts:addMicrosoft", async () => {
    const clientId = store.getSettings().msaClientId;
    return accounts.addMicrosoftAccount(clientId, win);
  });
  ipcMain.handle("accounts:remove", (_e, id: string) => accounts.removeAccount(id));

  ipcMain.handle("launch:start", async (_e, instance: Instance) => {
    if (runningProcesses.has(instance.id) || pendingLaunches.has(instance.id)) {
      throw new Error("This instance is already running.");
    }
    pendingLaunches.add(instance.id);
    const onLog = (event: LaunchLogEvent) => sendToRenderer("launch:log", event);
    try {
      // Keep the preinstalled Omega mod current on every launch (also self-heals a deleted jar).
      await ensureOmegaMods(instance, (line) => onLog({ instanceId: instance.id, stream: "status", data: line }));
      const msaClientId = store.getSettings().msaClientId;
      const handle = await launchInstance(instance, msaClientId, onLog);
      runningProcesses.set(instance.id, handle.process);
      handle.process.on("exit", () => {
        runningProcesses.delete(instance.id);
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
      proc.kill();
      runningProcesses.delete(instanceId);
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
