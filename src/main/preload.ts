import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, ConfigFormat, CreateInstanceInput, Instance, LaunchLogEvent, ModTag, PublicAccount } from "../shared/types";

const api = {
  instances: {
    list: () => ipcRenderer.invoke("instances:list"),
    create: (input: CreateInstanceInput) => ipcRenderer.invoke("instances:create", input),
    update: (instance: Instance) => ipcRenderer.invoke("instances:update", instance),
    delete: (id: string) => ipcRenderer.invoke("instances:delete", id),
    detectVersions: (gameDir: string) => ipcRenderer.invoke("instances:detectVersions", gameDir),
  },
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:pickDirectory"),
    pickJarFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:pickJarFiles"),
  },
  mods: {
    list: (modsDir: string) => ipcRenderer.invoke("mods:list", modsDir),
    import: (modsDir: string, sourcePaths: string[]) => ipcRenderer.invoke("mods:import", modsDir, sourcePaths),
    setEnabled: (modsDir: string, modId: string, enabled: boolean) =>
      ipcRenderer.invoke("mods:setEnabled", modsDir, modId, enabled),
    remove: (modsDir: string, modId: string) => ipcRenderer.invoke("mods:remove", modsDir, modId),
    applyPreset: (modsDir: string, tags: ModTag[]) => ipcRenderer.invoke("mods:applyPreset", modsDir, tags),
    setEnabledBulk: (modsDir: string, changes: Record<string, boolean>) =>
      ipcRenderer.invoke("mods:setEnabledBulk", modsDir, changes),
  },
  modConfig: {
    find: (modsDir: string, modId: string): Promise<string | null> => ipcRenderer.invoke("modconfig:find", modsDir, modId),
    read: (filePath: string) => ipcRenderer.invoke("modconfig:read", filePath),
    write: (filePath: string, format: ConfigFormat, data: Record<string, unknown>) =>
      ipcRenderer.invoke("modconfig:write", filePath, format, data),
  },
  java: {
    detect: (gameDir?: string) => ipcRenderer.invoke("java:detect", gameDir),
    verify: (javaPath: string) => ipcRenderer.invoke("java:verify", javaPath),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    set: (settings: AppSettings) => ipcRenderer.invoke("settings:set", settings),
  },
  accounts: {
    list: (): Promise<PublicAccount[]> => ipcRenderer.invoke("accounts:list"),
    addMicrosoft: (): Promise<PublicAccount> => ipcRenderer.invoke("accounts:addMicrosoft"),
    remove: (id: string): Promise<void> => ipcRenderer.invoke("accounts:remove", id),
  },
  launch: {
    start: (instance: Instance) => ipcRenderer.invoke("launch:start", instance),
    stop: (instanceId: string) => ipcRenderer.invoke("launch:stop", instanceId),
    isRunning: (instanceId: string): Promise<boolean> => ipcRenderer.invoke("launch:isRunning", instanceId),
    onLog: (callback: (event: LaunchLogEvent) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, event: LaunchLogEvent) => callback(event);
      ipcRenderer.on("launch:log", listener);
      return () => ipcRenderer.removeListener("launch:log", listener);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);

export type LauncherApi = typeof api;
