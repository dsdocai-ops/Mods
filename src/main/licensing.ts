// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { RedeemLicenseResult } from "../shared/types";
import { ensureOmegaConfig, readModConfigFile, writeModConfigFile } from "./modConfig";
import { listInstances } from "./instances";
import { getSettings } from "./store";

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
 * Validates a license key (a Stripe Checkout Session id, e.g. "cs_live_...") and, on success,
 * unlocks the associated cosmetic.
 *
 * Stripe secret keys must never live in the client (they can issue refunds/read customer data), so
 * this can't call Stripe's API directly - it POSTs the session id to your own deployed verify
 * function (see server/stripe-verify/README.md for the reference implementation + deploy steps),
 * which holds the real secret key and returns exactly this function's shape back. That URL is
 * user-configured (Settings -> Cosmetics -> "Stripe verify endpoint URL"), empty until you deploy
 * your own - this function reports that plainly rather than pretending to validate anything.
 */
export async function redeemLicenseKey(key: string): Promise<RedeemLicenseResult> {
  const endpoint = getSettings().stripeVerifyEndpointUrl.trim();
  if (!endpoint) {
    return { ok: false, message: "Cosmetics aren't set up yet - no Stripe verify endpoint is configured (see Settings)." };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: key }),
    });
  } catch (err) {
    return { ok: false, message: `Couldn't reach the verify server: ${err instanceof Error ? err.message : String(err)}` };
  }

  let result: RedeemLicenseResult;
  try {
    result = (await response.json()) as RedeemLicenseResult;
  } catch {
    return { ok: false, message: `Verify server returned an unexpected response (HTTP ${response.status}).` };
  }

  if (result.ok && result.cosmeticId) {
    unlockCosmetic(result.cosmeticId);
  }
  return result;
}
