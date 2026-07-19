// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { RedeemLicenseResult } from "../shared/types";
import { KNOWN_COSMETIC_IDS } from "../shared/cosmetics";
import { ensureOmegaConfig, readModConfigFile, writeModConfigFile } from "./modConfig";
import { listInstances } from "./instances";

const LICENSES_FILE = "licenses.json";

interface StoredLicenses {
  ownedCosmetics: string[];
  /**
   * The one cosmetic currently worn ("" = none) - tracked explicitly, NOT inferred from
   * ownedCosmetics' order: re-equipping an already-owned id doesn't move it within that array (it's
   * an append-only unlock history), so "last owned" and "currently equipped" are genuinely
   * different questions and need separate storage.
   */
  activeCosmetic: string;
}

// Plain JSON, not encrypted like accountStore.ts's tokens - there's no secret here to protect
// (which cosmetic you own isn't sensitive), and cosmetic ownership is already self-reported/
// editable at the mod-config layer regardless (see ModConfig.java's ownedCosmeticId javadoc), so
// encrypting this cache would add complexity without a real confidentiality or integrity benefit.
function licensesFilePath(): string {
  return path.join(app.getPath("userData"), LICENSES_FILE);
}

function readLicenses(): StoredLicenses {
  const file = licensesFilePath();
  if (!fs.existsSync(file)) return { ownedCosmetics: [], activeCosmetic: "" };
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    const partial = parsed as Partial<StoredLicenses>;
    return {
      ownedCosmetics: Array.isArray(partial?.ownedCosmetics) ? partial.ownedCosmetics : [],
      activeCosmetic: typeof partial?.activeCosmetic === "string" ? partial.activeCosmetic : "",
    };
  } catch {
    return { ownedCosmetics: [], activeCosmetic: "" };
  }
}

function writeLicenses(licenses: StoredLicenses): void {
  const file = licensesFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(licenses, null, 2), "utf-8");
}

export function getOwnedCosmetics(): string[] {
  return readLicenses().ownedCosmetics;
}

/** "" if nothing is currently equipped. */
export function getActiveCosmetic(): string {
  return readLicenses().activeCosmetic;
}

/**
 * Records a cosmetic as owned and writes it into every instance's mod config (ownedCosmeticId, read
 * by the mod at launch and broadcast over the presence channel - see CosmeticCatalog.java for known
 * ids). A player wears at most one cosmetic overall, so equipping one replaces whatever was worn
 * before - the thing you just unlocked (by redeeming a key, or re-equipping something you already
 * own) is presumably what you want showing. Real and independently callable/testable today, even
 * though redeemLicenseKey() below is the only current caller - this is what a real payment-provider
 * integration will call once one exists, and what the launcher's Cosmetics page calls to switch
 * which owned cosmetic is worn.
 */
export function unlockCosmetic(cosmeticId: string): void {
  const licenses = readLicenses();
  if (!licenses.ownedCosmetics.includes(cosmeticId)) {
    licenses.ownedCosmetics.push(cosmeticId);
  }
  licenses.activeCosmetic = cosmeticId;
  writeLicenses(licenses);

  for (const instance of listInstances()) {
    // One instance's config being unreadable/unwritable (corrupt JSON, permissions, disk full)
    // must not abort the loop and leave every instance after it in the list un-unlocked - each
    // instance is independent, so a failure here is caught and skipped rather than propagated.
    try {
      const configPath = ensureOmegaConfig(path.dirname(instance.modsDir));
      const configFile = readModConfigFile(configPath);
      writeModConfigFile(configPath, configFile.format, { ...configFile.data, ownedCosmeticId: cosmeticId });
    } catch {
      // Best-effort: licenses.json (source of truth for the launcher UI) is already updated above,
      // and the mod re-derives ownedCosmeticId from this same write path the next time any config
      // change touches this instance.
    }
  }
}

/**
 * Re-equips an already-owned cosmetic (the launcher Cosmetics page's "switch back to something you
 * already own" action, as opposed to unlockCosmetic's "just redeemed/paid for this"). Throws if the
 * id isn't owned - a renderer bug or a tampered IPC call shouldn't be able to equip something that
 * was never actually unlocked, even though the underlying config write is itself just a soft,
 * self-reported gate (see the LICENSE_SECRET comment below).
 */
export function equipOwnedCosmetic(cosmeticId: string): void {
  if (!readLicenses().ownedCosmetics.includes(cosmeticId)) {
    throw new Error("You don't own that cosmetic.");
  }
  unlockCosmetic(cosmeticId);
}

// Replace with your own secret before shipping - keys are generated with the matching formula in
// scripts/generate-license-key.cjs, kept privately (not part of the shipped app), and handed out
// manually once a purchase via the Stripe link in shared/cosmetics.ts is confirmed. Same self-
// reported trust model as everything else in this app (see ModConfig.java's ownedCosmeticId
// javadoc): this check lives entirely in the client, so it's a soft gate, not real DRM - proportionate
// to a vanity-only cosmetic, not something worth a backend for.
const LICENSE_SECRET = "REPLACE_ME_WITH_YOUR_OWN_SECRET";

function expectedSuffix(cosmeticId: string): string {
  return crypto.createHmac("sha256", LICENSE_SECRET).update(cosmeticId).digest("hex").slice(0, 12);
}

/** Validates a license key (format: "<cosmeticId>-<suffix>", e.g. "gold_badge-a1b2c3d4e5f6") and, on success, unlocks the associated cosmetic. */
export async function redeemLicenseKey(key: string): Promise<RedeemLicenseResult> {
  const trimmed = key.trim();
  const separatorIndex = trimmed.lastIndexOf("-");
  if (separatorIndex <= 0) {
    return { ok: false, message: "That doesn't look like a valid license key." };
  }

  const cosmeticId = trimmed.slice(0, separatorIndex);
  const suffix = trimmed.slice(separatorIndex + 1);
  if (!(KNOWN_COSMETIC_IDS as readonly string[]).includes(cosmeticId)) {
    return { ok: false, message: "That license key isn't valid." };
  }
  const expected = expectedSuffix(cosmeticId);
  const suffixBuf = Buffer.from(suffix, "utf-8");
  const expectedBuf = Buffer.from(expected, "utf-8");
  // crypto.timingSafeEqual throws on a length mismatch instead of just returning false, so a
  // wrong-length guess (nearly every one, since a valid suffix is a fixed 12 hex chars) has to be
  // handled explicitly rather than falling through to a fast, length-revealing `!==` compare.
  const valid = suffixBuf.length === expectedBuf.length && crypto.timingSafeEqual(suffixBuf, expectedBuf);
  if (!valid) {
    return { ok: false, message: "That license key isn't valid." };
  }

  unlockCosmetic(cosmeticId);
  return { ok: true, cosmeticId, message: `Unlocked: ${cosmeticId}` };
}
