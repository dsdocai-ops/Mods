// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type {
  AppSettings,
  ConfigFormat,
  CreateInstanceInput,
  DetectedVersion,
  InstallableVersion,
  InstallProgress,
  Instance,
  LaunchLogEvent,
  Loader,
  ModConfigFile,
  ModInfo,
  ModrinthInstallProgress,
  ModrinthInstallResult,
  ModrinthSearchHit,
  ModrinthUpdate,
  ModTag,
  PublicAccount,
  RedeemLicenseResult,
  ShaderPackInfo,
} from "@shared/types";

export interface LauncherApi {
  instances: {
    list(): Promise<Instance[]>;
    create(input: CreateInstanceInput): Promise<Instance>;
    update(instance: Instance): Promise<Instance>;
    delete(id: string): Promise<void>;
    detectVersions(gameDir: string): Promise<DetectedVersion[]>;
  };
  dialog: {
    pickDirectory(): Promise<string | null>;
    pickJarFiles(): Promise<string[]>;
    pickShaderFiles(): Promise<string[]>;
  };
  external: {
    open(url: string): Promise<boolean>;
  };
  mods: {
    list(modsDir: string): Promise<ModInfo[]>;
    import(modsDir: string, sourcePaths: string[]): Promise<ModInfo[]>;
    setEnabled(modsDir: string, modId: string, enabled: boolean): Promise<ModInfo[]>;
    remove(modsDir: string, modId: string): Promise<ModInfo[]>;
    applyPreset(modsDir: string, tags: ModTag[]): Promise<ModInfo[]>;
    setEnabledBulk(modsDir: string, changes: Record<string, boolean>): Promise<ModInfo[]>;
  };
  modrinth: {
    search(query: string, loader: Loader, versionId: string): Promise<ModrinthSearchHit[]>;
    install(modsDir: string, projectId: string, loader: Loader, versionId: string): Promise<ModrinthInstallResult>;
    checkUpdates(modsDir: string, loader: Loader, versionId: string): Promise<ModrinthUpdate[]>;
    applyUpdates(modsDir: string, updates: ModrinthUpdate[], loader: Loader, versionId: string): Promise<ModrinthInstallResult>;
    onProgress(callback: (progress: ModrinthInstallProgress) => void): () => void;
  };
  shaders: {
    list(modsDir: string): Promise<ShaderPackInfo[]>;
    import(modsDir: string, sourcePaths: string[]): Promise<ShaderPackInfo[]>;
    remove(modsDir: string, fileName: string): Promise<ShaderPackInfo[]>;
    hasLoader(instance: Instance): Promise<boolean>;
    installLoader(instance: Instance): Promise<{ installed: string[] }>;
  };
  modConfig: {
    find(modsDir: string, modId: string): Promise<string | null>;
    read(filePath: string): Promise<ModConfigFile>;
    write(filePath: string, format: ConfigFormat, data: Record<string, unknown>): Promise<void>;
  };
  java: {
    detect(gameDir?: string): Promise<string[]>;
    verify(javaPath: string): Promise<{ ok: boolean; version: string }>;
  };
  licensing: {
    redeem(key: string): Promise<RedeemLicenseResult>;
    listOwned(): Promise<string[]>;
    getActive(): Promise<string>;
    equip(cosmeticId: string): Promise<void>;
  };
  install: {
    listVersions(): Promise<InstallableVersion[]>;
    start(gameDir: string, versionId: string, loader: "vanilla" | "fabric" | "forge"): Promise<string>;
    onProgress(callback: (progress: InstallProgress) => void): () => void;
  };
  updates: {
    install(): Promise<boolean>;
    checkNow(): Promise<"unsupported" | "ready" | "downloading" | "checked" | "error">;
    onReady(callback: (version: string) => void): () => void;
  };
  settings: {
    get(): Promise<AppSettings>;
    set(settings: AppSettings): Promise<AppSettings>;
  };
  accounts: {
    list(): Promise<PublicAccount[]>;
    addMicrosoft(): Promise<PublicAccount>;
    /** TEMPORARY (testing only): offline account that bypasses Microsoft sign-in. */
    addOffline(username: string): Promise<PublicAccount>;
    remove(id: string): Promise<void>;
  };
  launch: {
    start(instance: Instance): Promise<boolean>;
    stop(instanceId: string): Promise<boolean>;
    isRunning(instanceId: string): Promise<boolean>;
    onLog(callback: (event: LaunchLogEvent) => void): () => void;
    onSwitchAccountRequested(callback: (instanceId: string) => void): () => void;
  };
}

declare global {
  interface Window {
    api: LauncherApi;
  }
}
