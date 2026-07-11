#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Not shipped with the app, not called by any app code - a private tool for generating a key to
// hand a buyer once you've confirmed their Stripe payment yourself. Must use the exact same
// LICENSE_SECRET as src/main/licensing.ts's expectedSuffix() - keep the two in sync yourself if you
// change it.
//
// Usage: node scripts/generate-license-key.cjs gold_badge
const crypto = require("crypto");

const LICENSE_SECRET = "REPLACE_ME_WITH_YOUR_OWN_SECRET";
const KNOWN_COSMETIC_IDS = ["gold_badge", "azure_badge", "crimson_cape", "nightfall_cape", "seraph_wings", "obsidian_top_hat", "navy_captain_hat", "starlit_cape", "eclipse_cape", "inferno_wings", "azure_charm_hat"];

const cosmeticId = process.argv[2];
if (!cosmeticId) {
  console.error("Usage: node scripts/generate-license-key.cjs <cosmeticId>");
  console.error(`Known cosmetic ids: ${KNOWN_COSMETIC_IDS.join(", ")}`);
  process.exit(1);
}
if (!KNOWN_COSMETIC_IDS.includes(cosmeticId)) {
  console.error(`Unknown cosmetic id "${cosmeticId}" - known ids: ${KNOWN_COSMETIC_IDS.join(", ")}`);
  process.exit(1);
}

const suffix = crypto.createHmac("sha256", LICENSE_SECRET).update(cosmeticId).digest("hex").slice(0, 12);
console.log(`${cosmeticId}-${suffix}`);
