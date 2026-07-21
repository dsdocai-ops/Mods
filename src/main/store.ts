// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AppSettings, Instance } from "../shared/types";
import { DEFAULT_JVM } from "../shared/types";

interface StoreShape {
  instances: Instance[];
  settings: AppSettings;
}

// Omega Client's own Azure AD app registration (public client, personal-Microsoft-accounts-only,
// "Allow public client flows" on) - shared by every user so sign-in works out of the box, the same
// model MultiMC/Lunar-style launchers use. No secret is embedded here or ever needed: this is a
// public client id, not a credential - the actual OAuth flow (msAuth.ts) uses PKCE, which is
// specifically designed to be safe with a client id that ships in distributed app code. Still
// overridable in Settings for anyone who'd rather use their own app registration.
const DEFAULT_MSA_CLIENT_ID = "5f2f3f73-32a1-4694-af21-19681a58701d";

const DEFAULT_STORE: StoreShape = {
  instances: [],
  settings: {
    defaultJvm: DEFAULT_JVM,
    defaultOfflineUsername: "Player",
    msaClientId: DEFAULT_MSA_CLIENT_ID,
    autoUpdateEnabled: true,
    showModDownloadWarning: true,
    discordRichPresenceEnabled: true,
    launchAnimationsEnabled: true,
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
        // || not ?? deliberately: an existing install's launcher-store.json may have "" saved from
        // before this default existed (when there was no working default at all) - that empty
        // string should fall through to the new default too, not get stuck empty forever. A real
        // custom client id a user has since set is truthy and passes through unchanged either way.
        msaClientId: parsed.settings?.msaClientId || DEFAULT_MSA_CLIENT_ID,
        autoUpdateEnabled: parsed.settings?.autoUpdateEnabled ?? true,
        showModDownloadWarning: parsed.settings?.showModDownloadWarning ?? true,
        discordRichPresenceEnabled: parsed.settings?.discordRichPresenceEnabled ?? true,
        launchAnimationsEnabled: parsed.settings?.launchAnimationsEnabled ?? true,
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
