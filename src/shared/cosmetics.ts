// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/** One purchasable cosmetic badge. `colorHex` mirrors CosmeticCatalog.java's BADGE_COLORS. */
export interface Cosmetic {
  id: string;
  name: string;
  /** Badge color as CSS hex - the exact same value CosmeticCatalog.java broadcasts/renders in-game. */
  colorHex: string;
  description: string;
}

/**
 * The cosmetic catalog, mirrored field-for-field against mod/common/.../presence/CosmeticCatalog.java
 * (same mirror convention as ModConfig defaults in main/modConfig.ts). The Java side only needs each
 * id's color (all it renders in-game is a colored Ω badge); the name/description here are launcher-UI
 * only. Keep the ids and colors in lockstep with CosmeticCatalog.java's BADGE_COLORS.
 */
export const COSMETIC_CATALOG: Cosmetic[] = [
  { id: "gold_badge", name: "Gold Badge", colorHex: "#FFD700", description: "A gold Ω badge beside your name in-game." },
  { id: "azure_badge", name: "Azure Badge", colorHex: "#3B9CFF", description: "An azure Ω badge beside your name in-game." },
];

/** The badge color a player with no cosmetic shows - mirrors CosmeticCatalog.DEFAULT_BADGE_RGB (0xE63946). */
export const DEFAULT_BADGE_HEX = "#E63946";

/** Id list, still exported for the license-key validator (see main/licensing.ts). */
export const KNOWN_COSMETIC_IDS = COSMETIC_CATALOG.map((c) => c.id) as readonly string[];

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id);
}

/**
 * Where to buy a cosmetic - opened via `external:open` (renderer -> main, https-only) same as every
 * sponsor placement in shared/affiliates.ts. Replace with your real Stripe Payment Link.
 */
export const STRIPE_COSMETIC_PAYMENT_LINK_URL = "https://buy.stripe.com/REPLACE_ME";
