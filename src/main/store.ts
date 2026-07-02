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
      // Array.isArray, not just ?? - a hand-corrupted `"instances": {}` is truthy and would pass
      // straight through to .sort()/.find() callers instead of degrading to an empty list.
      instances: Array.isArray(parsed.instances) ? parsed.instances : [],
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

// The renderer re-fetches instances/settings constantly (every page navigation, every mod toggle's
// onInstanceChanged refresh, every AccountSwitcher mount) - without this, each of those was a fresh
// synchronous readFileSync + JSON.parse of the whole store file, blocking Electron's single main
// thread (window/IPC/menus, everything) for the duration. All mutations go through this module, so
// there's no external writer to race - the cache is always accurate once populated.
let cachedStore: StoreShape | null = null;

function getStore(): StoreShape {
  if (!cachedStore) {
    cachedStore = readStore();
  }
  return cachedStore;
}

function persist(): void {
  if (cachedStore) writeStore(cachedStore);
}

export function getInstances(): Instance[] {
  return [...getStore().instances];
}

export function saveInstance(instance: Instance): Instance {
  const store = getStore();
  const idx = store.instances.findIndex((i) => i.id === instance.id);
  if (idx >= 0) {
    store.instances[idx] = instance;
  } else {
    store.instances.push(instance);
  }
  persist();
  return instance;
}

export function deleteInstance(id: string): void {
  const store = getStore();
  store.instances = store.instances.filter((i) => i.id !== id);
  persist();
}

export function getSettings(): AppSettings {
  // Deep copy, not spread: settings.defaultJvm is nested, and a shallow copy would hand callers a
  // live reference into the cache - safe with today's callers (they copy before mutating), but a
  // silent-corruption footgun for any future one that doesn't.
  return structuredClone(getStore().settings);
}

export function saveSettings(settings: AppSettings): AppSettings {
  const store = getStore();
  store.settings = settings;
  persist();
  return settings;
}
