import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AppSettings, Instance } from "../shared/types";
import { DEFAULT_JVM } from "../shared/types";

interface StoreShape {
  instances: Instance[];
  settings: AppSettings;
}

const DEFAULT_STORE: StoreShape = {
  instances: [],
  settings: {
    defaultJvm: DEFAULT_JVM,
    defaultOfflineUsername: "Player",
    msaClientId: "",
  },
};

function storeFilePath(): string {
  return path.join(app.getPath("userData"), "launcher-store.json");
}

function readStore(): StoreShape {
  const file = storeFilePath();
  if (!fs.existsSync(file)) {
    return structuredClone(DEFAULT_STORE);
  }
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      instances: parsed.instances ?? [],
      settings: {
        defaultJvm: { ...DEFAULT_JVM, ...(parsed.settings?.defaultJvm ?? {}) },
        defaultOfflineUsername: parsed.settings?.defaultOfflineUsername ?? "Player",
        msaClientId: parsed.settings?.msaClientId ?? "",
      },
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

function writeStore(store: StoreShape): void {
  const file = storeFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf-8");
}

export function getInstances(): Instance[] {
  return readStore().instances;
}

export function saveInstance(instance: Instance): Instance {
  const store = readStore();
  const idx = store.instances.findIndex((i) => i.id === instance.id);
  if (idx >= 0) {
    store.instances[idx] = instance;
  } else {
    store.instances.push(instance);
  }
  writeStore(store);
  return instance;
}

export function deleteInstance(id: string): void {
  const store = readStore();
  store.instances = store.instances.filter((i) => i.id !== id);
  writeStore(store);
}

export function getSettings(): AppSettings {
  return readStore().settings;
}

export function saveSettings(settings: AppSettings): AppSettings {
  const store = readStore();
  store.settings = settings;
  writeStore(store);
  return settings;
}
