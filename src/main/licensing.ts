// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { RedeemLicenseResult } from "../shared/types";
import type { ActiveSlots, CosmeticType } from "../shared/cosmetics";
import { EMPTY_ACTIVE_SLOTS, KNOWN_COSMETIC_IDS, cosmeticById } from "../shared/cosmetics";
import { ensureOmegaConfig, readModConfigFile, writeModConfigFile } from "./modConfig";
import { listInstances } from "./instances";

const EMPTY_SLOTS = EMPTY_ACTIVE_SLOTS;

const LICENSES_FILE = "licenses.json";

interface StoredLicenses {
  ownedCosmetics: string[];
  /** The active cosmetic per slot - a player can wear one hat + one cape + one wings at once. */
  activeSlots: ActiveSlots;
}

// Plain JSON, not encrypted like accountStore.ts's tokens - there's no secret here to protect
// (which cosmetic you own isn't sensitive), and cosmetic ownership is already self-reported/
// editable at the mod-config layer regardless (see ModConfig.java's ownedCosmeticId javadoc), so
// encrypting this cache would add complexity without a real confidentiality or integrity benefit.
function licensesFilePath(): string {
  return path.join(app.getPath("userData"), LICENSES_FILE);
}

function slotOf(cosmeticId: string): CosmeticType | undefined {
  return cosmeticById(cosmeticId)?.type;
}

function readLicenses(): StoredLicenses {
  const file = licensesFilePath();
  if (!fs.existsSync(file)) return { ownedCosmetics: [], activeSlots: { ...EMPTY_SLOTS } };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<StoredLicenses> & { activeCosmetic?: string };
    const ownedCosmetics = Array.isArray(parsed?.ownedCosmetics) ? parsed.ownedCosmetics : [];
    const slots: ActiveSlots = { ...EMPTY_SLOTS, ...(parsed?.activeSlots ?? {}) };
    // Migrate a file from before cosmetics had slots: its single activeCosmetic drops into the slot
    // its type maps to, so an upgrade doesn't blank someone's cosmetic.
    if (!parsed?.activeSlots && typeof parsed?.activeCosmetic === "string" && parsed.activeCosmetic) {
      const type = slotOf(parsed.activeCosmetic);
      if (type) slots[type] = parsed.activeCosmetic;
    }
    return { ownedCosmetics, activeSlots: slots };
  } catch {
    return { ownedCosmetics: [], activeSlots: { ...EMPTY_SLOTS } };
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

/** The active cosmetic per slot ("" = nothing worn there). */
export function getActiveSlots(): ActiveSlots {
  return readLicenses().activeSlots;
}

/** First non-empty slot in priority order - the cosmetic that tints the Ω name badge (mirrors OmegaPresence.CosmeticSet.primary). */
function primaryOf(slots: ActiveSlots): string {
  return slots.hat || slots.cape || slots.wings || "";
}

/**
 * Writes the active-per-slot cosmetics into every instance's mod config (active*Id, read by the mod
 * at launch and broadcast over the presence channel - see CosmeticCatalog.java). ownedCosmeticId is
 * kept in sync with the badge "primary" for the deprecated single-id path. Best-effort per instance:
 * one unreadable/unwritable config (corrupt JSON, permissions, disk full) is skipped rather than
 * aborting the loop for every instance after it.
 */
function applyActiveSlotsToInstances(slots: ActiveSlots): void {
  const patch = {
    activeHatId: slots.hat,
    activeCapeId: slots.cape,
    activeWingsId: slots.wings,
    ownedCosmeticId: primaryOf(slots),
  };
  for (const instance of listInstances()) {
    try {
      const configPath = ensureOmegaConfig(path.dirname(instance.modsDir));
      const configFile = readModConfigFile(configPath);
      writeModConfigFile(configPath, configFile.format, { ...configFile.data, ...patch });
    } catch {
      // licenses.json (the launcher UI's source of truth) is already updated by the caller, and the
      // mod re-derives these fields from this same write path the next time any config change touches
      // this instance.
    }
  }
}

/**
 * Records a cosmetic as owned and equips it in its slot (leaving the other slots as they are), then
 * pushes the new slot set into every instance's config. This is what a real payment-provider
 * integration calls, and what redeemLicenseKey() calls on a valid key.
 */
export function unlockCosmetic(cosmeticId: string): void {
  const licenses = readLicenses();
  if (!licenses.ownedCosmetics.includes(cosmeticId)) {
    licenses.ownedCosmetics.push(cosmeticId);
  }
  // Equip the newly-unlocked cosmetic in its slot (the thing you just paid for is presumably what
  // you want to show), without disturbing the other slots.
  const type = slotOf(cosmeticId);
  if (type) licenses.activeSlots[type] = cosmeticId;
  writeLicenses(licenses);
  applyActiveSlotsToInstances(licenses.activeSlots);
}

/**
 * Sets (or clears, with "") which owned cosmetic is worn in a given slot, leaving the other slots
 * alone. Rejects a cosmetic the user doesn't own, or one whose type doesn't match the slot, so a
 * slot can never point at an unowned or wrong-type id. Returns the full new slot set.
 */
export function setActiveSlot(slot: CosmeticType, cosmeticId: string): ActiveSlots {
  const licenses = readLicenses();
  if (cosmeticId !== "") {
    if (!licenses.ownedCosmetics.includes(cosmeticId)) throw new Error("You don't own that cosmetic.");
    if (slotOf(cosmeticId) !== slot) throw new Error("That cosmetic can't go in that slot.");
  }
  licenses.activeSlots[slot] = cosmeticId;
  writeLicenses(licenses);
  applyActiveSlotsToInstances(licenses.activeSlots);
  return licenses.activeSlots;
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
