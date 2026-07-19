// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app, safeStorage, type BrowserWindow } from "electron";
import type { PublicAccount } from "../shared/types";
import { loginInteractive, refreshAccount } from "./msAuth";

interface StoredAccount {
  id: string;
  type: "microsoft" | "offline";
  username: string;
  uuid: string;
  refreshTokenBlob: string;
  accessTokenBlob: string;
  accessTokenExpiresAt: number;
  addedAt: number;
}

const ACCOUNTS_FILE = "accounts.json";
// Marks a blob as unencrypted, used only on the rare system where the OS has no secret-storage
// backend for Electron's safeStorage to use - so we never try to safeStorage.decrypt() plain text
// and crash, and it's obvious in the stored file that a value wasn't actually encrypted.
const PLAINTEXT_PREFIX = "plaintext:";
const EXPIRY_BUFFER_MS = 60_000;

function accountsFilePath(): string {
  return path.join(app.getPath("userData"), ACCOUNTS_FILE);
}

function encryptToBlob(text: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(text).toString("base64");
  }
  return PLAINTEXT_PREFIX + Buffer.from(text, "utf-8").toString("base64");
}

function decryptFromBlob(blob: string): string {
  if (blob.startsWith(PLAINTEXT_PREFIX)) {
    return Buffer.from(blob.slice(PLAINTEXT_PREFIX.length), "base64").toString("utf-8");
  }
  return safeStorage.decryptString(Buffer.from(blob, "base64"));
}

// Same reasoning as store.ts's cache: listAccounts() gets called on every AccountSwitcher/Settings
// mount, and every mutation here already goes through writeAll() below, so there's nothing else
// that can change the file underneath us - safe to avoid a disk read+parse on every list call.
let cachedAccounts: StoredAccount[] | null = null;

function readAll(): StoredAccount[] {
  if (cachedAccounts) return cachedAccounts;
  const file = accountsFilePath();
  if (!fs.existsSync(file)) {
    cachedAccounts = [];
    return cachedAccounts;
  }
  try {
    // Array.isArray, not just parse-success: a corrupted/hand-edited file containing `{}` or
    // `null` is valid JSON that doesn't throw, and returning a non-array here would crash every
    // caller (.map/.filter/.findIndex) instead of degrading to "no accounts".
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    cachedAccounts = Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    cachedAccounts = [];
  }
  return cachedAccounts;
}

function writeAll(accounts: StoredAccount[]): void {
  cachedAccounts = accounts;
  const file = accountsFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(accounts, null, 2), "utf-8");
}

function toPublic(account: StoredAccount): PublicAccount {
  return { id: account.id, type: account.type, username: account.username, uuid: account.uuid, addedAt: account.addedAt };
}

export function listAccounts(): PublicAccount[] {
  return readAll().map(toPublic);
}

export function removeAccount(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Runs the interactive Microsoft sign-in flow and stores the resulting account (encrypted at rest). Re-signing in with the same account updates it in place rather than duplicating it. */
export async function addMicrosoftAccount(clientId: string, parentWindow: BrowserWindow): Promise<PublicAccount> {
  const result = await loginInteractive(clientId, parentWindow);
  const accounts = readAll();
  const existingIndex = accounts.findIndex((a) => a.uuid === result.uuid);

  const stored: StoredAccount = {
    id: existingIndex >= 0 ? accounts[existingIndex].id : crypto.randomUUID(),
    type: "microsoft",
    username: result.username,
    uuid: result.uuid,
    refreshTokenBlob: encryptToBlob(result.msRefreshToken),
    accessTokenBlob: encryptToBlob(result.mcAccessToken),
    accessTokenExpiresAt: result.mcAccessTokenExpiresAt,
    addedAt: existingIndex >= 0 ? accounts[existingIndex].addedAt : Date.now(),
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = stored;
  } else {
    accounts.push(stored);
  }
  writeAll(accounts);
  return toPublic(stored);
}

/**
 * TEMPORARY (testing only): the same offline UUID vanilla servers derive in offline mode -
 * a name-based (version 3) UUID of "OfflinePlayer:<name>", i.e. Java's
 * UUID.nameUUIDFromBytes(). Matching that keeps skins-off/offline-server identity consistent
 * with what the rest of the ecosystem expects for this username.
 */
function offlineUuid(username: string): string {
  const hash = crypto.createHash("md5").update(`OfflinePlayer:${username}`, "utf-8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3 (name-based)
  hash[8] = (hash[8] & 0x3f) | 0x80; // IETF variant
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * TEMPORARY (testing only): stores an offline account that bypasses Microsoft sign-in entirely,
 * so the launcher can be exercised end-to-end while real sign-in is blocked on Mojang's
 * client-ID approval. No tokens are involved; launch.ts starts these as an offline session.
 * Remove together with the sign-in screen's offline button once sign-in works.
 */
export function addOfflineAccount(usernameRaw: string): PublicAccount {
  // Minecraft usernames: 3-16 chars of [A-Za-z0-9_]. Sanitize rather than reject - this is a
  // testing convenience, not a real account flow.
  const username = usernameRaw.trim().replace(/[^A-Za-z0-9_]/g, "_").slice(0, 16) || "Player";
  const accounts = readAll();
  const uuid = offlineUuid(username);
  const existingIndex = accounts.findIndex((a) => a.uuid === uuid);

  const stored: StoredAccount = {
    id: existingIndex >= 0 ? accounts[existingIndex].id : crypto.randomUUID(),
    type: "offline",
    username,
    uuid,
    refreshTokenBlob: "",
    accessTokenBlob: "",
    accessTokenExpiresAt: 0,
    addedAt: existingIndex >= 0 ? accounts[existingIndex].addedAt : Date.now(),
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = stored;
  } else {
    accounts.push(stored);
  }
  writeAll(accounts);
  return toPublic(stored);
}

// Coalesces concurrent refreshes for the same account - two instances configured with the same
// Microsoft account, launched within moments of each other while the cached token is expired,
// would otherwise both read the same about-to-be-stale refresh token, both call refreshAccount()
// independently, and race to writeAll() - whichever finishes last silently discards the other's
// persisted result (and, if Microsoft has already rotated/invalidated the refresh token by then,
// the loser's call can simply fail with a spurious error on that instance's launch).
const inFlightRefreshes = new Map<string, Promise<AccountSession>>();

export interface AccountSession {
  accessToken: string;
  uuid: string;
  username: string;
  /** "legacy" marks a TEMPORARY offline testing session (no real token) - see addOfflineAccount. */
  userType: "msa" | "legacy";
}

/**
 * Returns a currently-valid Minecraft access token for an account, silently refreshing it first
 * if it's expired or about to expire. This is what launch.ts calls right before starting the game.
 */
export async function getValidAccessToken(clientId: string, accountId: string): Promise<AccountSession> {
  const accounts = readAll();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index < 0) {
    throw new Error("Selected account no longer exists - pick another account or sign in again in Settings.");
  }
  const account = accounts[index];

  if (account.type === "offline") {
    // No real session exists to fetch or refresh - hand launch.ts a dummy token. Enough for
    // singleplayer and offline-mode servers; anything requiring authentication won't work.
    return { accessToken: "offline", uuid: account.uuid, username: account.username, userType: "legacy" };
  }

  if (Date.now() + EXPIRY_BUFFER_MS < account.accessTokenExpiresAt) {
    return { accessToken: decryptFromBlob(account.accessTokenBlob), uuid: account.uuid, username: account.username, userType: "msa" };
  }

  const existing = inFlightRefreshes.get(accountId);
  if (existing) return existing;

  const refreshPromise = (async () => {
    const refreshToken = decryptFromBlob(account.refreshTokenBlob);
    const refreshed = await refreshAccount(clientId, refreshToken);

    // Re-read rather than reuse the outer `accounts`/`index` - a concurrent removeAccount() could
    // have changed the list while the network round trip above was in flight.
    const current = readAll();
    const currentIndex = current.findIndex((a) => a.id === accountId);
    if (currentIndex >= 0) {
      current[currentIndex] = {
        ...current[currentIndex],
        username: refreshed.username,
        uuid: refreshed.uuid,
        refreshTokenBlob: encryptToBlob(refreshed.msRefreshToken),
        accessTokenBlob: encryptToBlob(refreshed.mcAccessToken),
        accessTokenExpiresAt: refreshed.mcAccessTokenExpiresAt,
      };
      writeAll(current);
    }

    return { accessToken: refreshed.mcAccessToken, uuid: refreshed.uuid, username: refreshed.username, userType: "msa" as const };
  })();

  inFlightRefreshes.set(accountId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    inFlightRefreshes.delete(accountId);
  }
}
