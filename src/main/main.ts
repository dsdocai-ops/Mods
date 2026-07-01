import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { AppSettings, ConfigFormat, CreateInstanceInput, Instance, LaunchLogEvent, ModTag } from "../shared/types";
import * as instances from "./instances";
import * as mods from "./mods";
import * as store from "./store";
import * as javaModule from "./java";
import { launchInstance } from "./launch";
import { findModConfigPath, readModConfigFile, writeModConfigFile } from "./modConfig";

const isDev = process.env.NODE_ENV === "development";
const runningProcesses = new Map<string, ChildProcess>();

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
    win.loadFile(path.join(__dirname, "../dist-renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  ipcMain.handle("instances:list", () => instances.listInstances());
  ipcMain.handle("instances:create", (_e, input: CreateInstanceInput) => instances.createInstance(input));
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
  ipcMain.handle("modconfig:read", (_e, filePath: string) => readModConfigFile(filePath));
  ipcMain.handle("modconfig:write", (_e, filePath: string, format: ConfigFormat, data: Record<string, unknown>) =>
    writeModConfigFile(filePath, format, data)
  );

  ipcMain.handle("java:detect", (_e, gameDir?: string) => javaModule.detectJavaCandidates(gameDir));
  ipcMain.handle("java:verify", (_e, javaPath: string) => javaModule.verifyJava(javaPath));

  ipcMain.handle("settings:get", () => store.getSettings());
  ipcMain.handle("settings:set", (_e, settings: AppSettings) => store.saveSettings(settings));

  ipcMain.handle("launch:start", (_e, instance: Instance) => {
    if (runningProcesses.has(instance.id)) {
      throw new Error("This instance is already running.");
    }
    const onLog = (event: LaunchLogEvent) => win.webContents.send("launch:log", event);
    try {
      const handle = launchInstance(instance, onLog);
      runningProcesses.set(instance.id, handle.process);
      handle.process.on("exit", () => runningProcesses.delete(instance.id));
      instances.markLaunched(instance.id);
      return true;
    } catch (err) {
      onLog({ instanceId: instance.id, stream: "stderr", data: err instanceof Error ? err.message : String(err) });
      throw err;
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  for (const proc of runningProcesses.values()) proc.kill();
  if (process.platform !== "darwin") app.quit();
});
