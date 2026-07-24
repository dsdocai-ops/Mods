#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Not shipped with the app, not called by any app code - a private tool for generating a coin top-up
// code to hand a buyer once you've confirmed their Stripe payment yourself. Must use the exact same
// WALLET_SECRET as src/main/wallet.ts's parseCoinCode() - keep the two in sync yourself if you change
// it.
//
// Usage: node scripts/generate-coin-code.cjs 500
const crypto = require("crypto");

const WALLET_SECRET = "REPLACE_ME_WITH_YOUR_OWN_SECRET";

const amount = Number(process.argv[2]);
if (!Number.isInteger(amount) || amount <= 0) {
  console.error("Usage: node scripts/generate-coin-code.cjs <amount>");
  process.exit(1);
}

const nonce = crypto.randomBytes(8).toString("hex");
const suffix = crypto.createHmac("sha256", WALLET_SECRET).update(`${amount}:${nonce}`).digest("hex").slice(0, 12);
console.log(`coins:${amount}-${nonce}-${suffix}`);
