// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { RedeemLicenseResult } from "../shared/types";
import { ensureOmegaConfig, readModConfigFile, writeModConfigFile } from "./modConfig";
import { listInstances } from "./instances";

const LICENSES_FILE = "licenses.json";

interface StoredLicenses {
  ownedCosmetics: string[];
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
  if (!fs.existsSync(file)) return { ownedCosmetics: [] };
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    const ownedCosmetics = (parsed as Partial<StoredLicenses>)?.ownedCosmetics;
    return { ownedCosmetics: Array.isArray(ownedCosmetics) ? ownedCosmetics : [] };
  } catch {
    return { ownedCosmetics: [] };
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

/**
 * Records a cosmetic as owned and writes it into every instance's mod config (ownedCosmeticId, read
 * by the mod at launch and broadcast over the presence channel - see CosmeticCatalog.java for known
 * ids). Real and independently callable/testable today, even though redeemLicenseKey() below can't
 * reach it yet - this is what a real payment-provider integration will call once one exists.
 */
export function unlockCosmetic(cosmeticId: string): void {
  const licenses = readLicenses();
  if (!licenses.ownedCosmetics.includes(cosmeticId)) {
    licenses.ownedCosmetics.push(cosmeticId);
    writeLicenses(licenses);
  }

  for (const instance of listInstances()) {
    const configPath = ensureOmegaConfig(path.dirname(instance.modsDir));
    const configFile = readModConfigFile(configPath);
    writeModConfigFile(configPath, configFile.format, { ...configFile.data, ownedCosmeticId: cosmeticId });
  }
}

/**
 * Validates a license key and, on success, unlocks the associated cosmetic.
 *
 * STUB: no payment provider has been chosen yet (see README's Monetization section) - this always
 * reports "not available" rather than validating against anything real. Swap this function's body
 * for a real call to your chosen provider's license-verify endpoint (Gumroad's `licenses/verify`, or
 * your own Stripe-backed server) once one is chosen, calling unlockCosmetic(cosmeticId) on success.
 * Every caller (the licensing:redeem IPC handler, the renderer's Cosmetics UI) stays exactly the
 * same regardless of what goes here - this is the only function that needs to change.
 */
export async function redeemLicenseKey(_key: string): Promise<RedeemLicenseResult> {
  return { ok: false, message: "Cosmetics aren't on sale yet - check back soon." };
}
