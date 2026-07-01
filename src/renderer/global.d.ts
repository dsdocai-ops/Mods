import type {
  AppSettings,
  ConfigFormat,
  CreateInstanceInput,
  DetectedVersion,
  Instance,
  LaunchLogEvent,
  ModConfigFile,
  ModInfo,
  ModTag,
  PublicAccount,
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
  };
  mods: {
    list(modsDir: string): Promise<ModInfo[]>;
    import(modsDir: string, sourcePaths: string[]): Promise<ModInfo[]>;
    setEnabled(modsDir: string, modId: string, enabled: boolean): Promise<ModInfo[]>;
    remove(modsDir: string, modId: string): Promise<ModInfo[]>;
    applyPreset(modsDir: string, tags: ModTag[]): Promise<ModInfo[]>;
    setEnabledBulk(modsDir: string, changes: Record<string, boolean>): Promise<ModInfo[]>;
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
  settings: {
    get(): Promise<AppSettings>;
    set(settings: AppSettings): Promise<AppSettings>;
  };
  accounts: {
    list(): Promise<PublicAccount[]>;
    addMicrosoft(): Promise<PublicAccount>;
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
