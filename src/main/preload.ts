// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  ConfigFormat,
  CreateInstanceInput,
  CurseForgeInstallProgress,
  CurseForgeInstallResult,
  CurseForgeSearchHit,
  FeaturedMod,
  InstallableVersion,
  InstallProgress,
  Instance,
  LaunchLogEvent,
  Loader,
  ModrinthInstallProgress,
  ModrinthInstallResult,
  ModrinthSearchHit,
  ModrinthUpdate,
  ModTag,
  PublicAccount,
  RedeemLicenseResult,
  ShaderPackInfo,
} from "../shared/types";

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
    pickShaderFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:pickShaderFiles"),
  },
  external: {
    open: (url: string): Promise<boolean> => ipcRenderer.invoke("external:open", url),
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
  modrinth: {
    search: (query: string, loader: Loader, versionId: string): Promise<ModrinthSearchHit[]> =>
      ipcRenderer.invoke("modrinth:search", query, loader, versionId),
    install: (modsDir: string, projectId: string, loader: Loader, versionId: string): Promise<ModrinthInstallResult> =>
      ipcRenderer.invoke("modrinth:install", modsDir, projectId, loader, versionId),
    checkUpdates: (modsDir: string, loader: Loader, versionId: string): Promise<ModrinthUpdate[]> =>
      ipcRenderer.invoke("modrinth:checkUpdates", modsDir, loader, versionId),
    applyUpdates: (modsDir: string, updates: ModrinthUpdate[], loader: Loader, versionId: string): Promise<ModrinthInstallResult> =>
      ipcRenderer.invoke("modrinth:applyUpdates", modsDir, updates, loader, versionId),
    onProgress: (callback: (progress: ModrinthInstallProgress) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, progress: ModrinthInstallProgress) => callback(progress);
      ipcRenderer.on("modrinth:installProgress", listener);
      return () => ipcRenderer.removeListener("modrinth:installProgress", listener);
    },
  },
  curseforge: {
    search: (query: string, loader: Loader, versionId: string): Promise<CurseForgeSearchHit[]> =>
      ipcRenderer.invoke("curseforge:search", query, loader, versionId),
    install: (modsDir: string, modId: number, loader: Loader, versionId: string): Promise<CurseForgeInstallResult> =>
      ipcRenderer.invoke("curseforge:install", modsDir, modId, loader, versionId),
    onProgress: (callback: (progress: CurseForgeInstallProgress) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, progress: CurseForgeInstallProgress) => callback(progress);
      ipcRenderer.on("curseforge:installProgress", listener);
      return () => ipcRenderer.removeListener("curseforge:installProgress", listener);
    },
  },
  featured: {
    list: (): Promise<FeaturedMod[]> => ipcRenderer.invoke("featured:list"),
  },
  shaders: {
    list: (modsDir: string): Promise<ShaderPackInfo[]> => ipcRenderer.invoke("shaders:list", modsDir),
    import: (modsDir: string, sourcePaths: string[]): Promise<ShaderPackInfo[]> =>
      ipcRenderer.invoke("shaders:import", modsDir, sourcePaths),
    remove: (modsDir: string, fileName: string): Promise<ShaderPackInfo[]> =>
      ipcRenderer.invoke("shaders:remove", modsDir, fileName),
    hasLoader: (instance: Instance): Promise<boolean> => ipcRenderer.invoke("shaders:hasLoader", instance),
    installLoader: (instance: Instance): Promise<{ installed: string[] }> => ipcRenderer.invoke("shaders:installLoader", instance),
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
  licensing: {
    redeem: (key: string): Promise<RedeemLicenseResult> => ipcRenderer.invoke("licensing:redeem", key),
    listOwned: (): Promise<string[]> => ipcRenderer.invoke("licensing:listOwned"),
    getActive: (): Promise<string> => ipcRenderer.invoke("licensing:getActive"),
    equip: (cosmeticId: string): Promise<void> => ipcRenderer.invoke("licensing:equip", cosmeticId),
  },
  install: {
    listVersions: (): Promise<InstallableVersion[]> => ipcRenderer.invoke("install:listVersions"),
    start: (gameDir: string, versionId: string, loader: "vanilla" | "fabric" | "forge"): Promise<string> =>
      ipcRenderer.invoke("install:start", gameDir, versionId, loader),
    onProgress: (callback: (progress: InstallProgress) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, progress: InstallProgress) => callback(progress);
      ipcRenderer.on("install:progress", listener);
      return () => ipcRenderer.removeListener("install:progress", listener);
    },
  },
  updates: {
    install: (): Promise<boolean> => ipcRenderer.invoke("updates:install"),
    onReady: (callback: (version: string) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, version: string) => callback(version);
      ipcRenderer.on("updates:ready", listener);
      return () => ipcRenderer.removeListener("updates:ready", listener);
    },
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    set: (settings: AppSettings) => ipcRenderer.invoke("settings:set", settings),
  },
  accounts: {
    list: (): Promise<PublicAccount[]> => ipcRenderer.invoke("accounts:list"),
    addMicrosoft: (): Promise<PublicAccount> => ipcRenderer.invoke("accounts:addMicrosoft"),
    // TEMPORARY (testing only): bypasses sign-in with an offline account - remove with the sign-in screen's offline button.
    addOffline: (username: string): Promise<PublicAccount> => ipcRenderer.invoke("accounts:addOffline", username),
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
    onSwitchAccountRequested: (callback: (instanceId: string) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, instanceId: string) => callback(instanceId);
      ipcRenderer.on("launch:switchAccountRequested", listener);
      return () => ipcRenderer.removeListener("launch:switchAccountRequested", listener);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);

export type LauncherApi = typeof api;
