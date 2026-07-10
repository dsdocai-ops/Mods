// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/** A hat silhouette for the launcher preview. The mod renders a colored box hat for all of them today; the shape is UI flavor + room to diverge later. */
export type CosmeticShape = "top_hat" | "crown" | "cap";

/**
 * One purchasable cosmetic - a colored hat worn on the player's head in-game (and, as before, the
 * matching color on the Ω name badge). `colorHex` mirrors CosmeticCatalog.java's BADGE_COLORS.
 */
export interface Cosmetic {
  id: string;
  name: string;
  /** Hat/badge color as CSS hex - the exact same value CosmeticCatalog.java broadcasts/renders in-game. */
  colorHex: string;
  shape: CosmeticShape;
  description: string;
}

/**
 * The cosmetic catalog, mirrored against mod/common/.../presence/CosmeticCatalog.java (same mirror
 * convention as ModConfig defaults in main/modConfig.ts). The Java side only needs each id's color
 * (it renders a colored hat on the head + the matching Ω badge); name/shape/description here are
 * launcher-UI only. Keep the ids and colors in lockstep with CosmeticCatalog.java's BADGE_COLORS.
 *
 * Note the ids still end in "_badge" - they're the license-key/config keys baked into
 * CosmeticCatalog.java and the redeem HMAC, so they stay stable even though the cosmetic is now a hat.
 */
export const COSMETIC_CATALOG: Cosmetic[] = [
  { id: "gold_badge", name: "Gold Top Hat", colorHex: "#FFD700", shape: "top_hat", description: "A gold hat worn on your head in-game, plus a gold Ω name badge." },
  { id: "azure_badge", name: "Azure Crown", colorHex: "#3B9CFF", shape: "crown", description: "An azure hat worn on your head in-game, plus an azure Ω name badge." },
];

/** The badge/hat color a player with no cosmetic shows - mirrors CosmeticCatalog.DEFAULT_BADGE_RGB (0xE63946). */
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
