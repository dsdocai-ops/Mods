import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app, safeStorage, type BrowserWindow } from "electron";
import type { PublicAccount } from "../shared/types";
import { loginInteractive, refreshAccount } from "./msAuth";

interface StoredAccount {
  id: string;
  type: "microsoft";
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

function readAll(): StoredAccount[] {
  const file = accountsFilePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(accounts: StoredAccount[]): void {
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
 * Returns a currently-valid Minecraft access token for an account, silently refreshing it first
 * if it's expired or about to expire. This is what launch.ts calls right before starting the game.
 */
export async function getValidAccessToken(clientId: string, accountId: string): Promise<{ accessToken: string; uuid: string; username: string }> {
  const accounts = readAll();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index < 0) {
    throw new Error("Selected account no longer exists - pick another account or sign in again in Settings.");
  }
  const account = accounts[index];

  if (Date.now() + EXPIRY_BUFFER_MS < account.accessTokenExpiresAt) {
    return { accessToken: decryptFromBlob(account.accessTokenBlob), uuid: account.uuid, username: account.username };
  }

  const refreshToken = decryptFromBlob(account.refreshTokenBlob);
  const refreshed = await refreshAccount(clientId, refreshToken);

  accounts[index] = {
    ...account,
    username: refreshed.username,
    uuid: refreshed.uuid,
    refreshTokenBlob: encryptToBlob(refreshed.msRefreshToken),
    accessTokenBlob: encryptToBlob(refreshed.mcAccessToken),
    accessTokenExpiresAt: refreshed.mcAccessTokenExpiresAt,
  };
  writeAll(accounts);

  return { accessToken: refreshed.mcAccessToken, uuid: refreshed.uuid, username: refreshed.username };
}
