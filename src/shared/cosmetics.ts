// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
/**
 * Mirrors the id list in mod/common/.../presence/CosmeticCatalog.java - field-for-field mirror
 * convention already used for ModConfig defaults (see main/modConfig.ts). The kind (badge color vs
 * hat/cape/wings gear) and colors live only in the Java catalog; this side needs just the ids.
 */
export const KNOWN_COSMETIC_IDS = [
  "gold_badge",
  "azure_badge",
  "crimson_cape",
  "nightfall_cape",
  "seraph_wings",
  "obsidian_top_hat",
  "navy_captain_hat",
  "starlit_cape",
  "eclipse_cape",
  "inferno_wings",
] as const;

/**
 * Where to buy a cosmetic - opened via `external:open` (renderer -> main, https-only) same as every
 * sponsor placement in shared/affiliates.ts. Replace with your real Stripe Payment Link.
 */
export const STRIPE_COSMETIC_PAYMENT_LINK_URL = "https://buy.stripe.com/REPLACE_ME";
