// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/** Where a cosmetic is worn. Hats sit on the head; capes and wings mount on the back. */
export type CosmeticType = "hat" | "cape" | "wings";

export const COSMETIC_TYPE_LABELS: Record<CosmeticType, string> = {
  hat: "Hats",
  cape: "Capes",
  wings: "Wings",
};

/** The active cosmetic per slot ("" = nothing worn there). Mirrors ModConfig.java's active*Id fields. */
export interface ActiveSlots {
  hat: string;
  cape: string;
  wings: string;
}

export const EMPTY_ACTIVE_SLOTS: ActiveSlots = { hat: "", cape: "", wings: "" };

/**
 * One purchasable cosmetic worn on the player in-game (plus the matching color on the Ω name badge).
 * `colorHex` mirrors CosmeticCatalog.java's BADGE_COLORS; `type` mirrors its TYPES map and decides
 * which renderer draws it (head vs back).
 */
export interface Cosmetic {
  id: string;
  name: string;
  /** Color as CSS hex - the exact same value CosmeticCatalog.java broadcasts/renders in-game. */
  colorHex: string;
  type: CosmeticType;
  description: string;
}

/**
 * The cosmetic catalog, mirrored against mod/common/.../presence/CosmeticCatalog.java (same mirror
 * convention as ModConfig defaults in main/modConfig.ts). The Java side needs each id's color and
 * type (color for the badge/cosmetic tint, type to pick head vs back rendering); name/description
 * here are launcher-UI only. Keep ids, colors, and types in lockstep with CosmeticCatalog.java.
 *
 * The two hat ids still end in "_badge" - they're the license-key/config keys baked into
 * CosmeticCatalog.java and the redeem HMAC from before cosmetics had types, so they stay stable.
 */
export const COSMETIC_CATALOG: Cosmetic[] = [
  { id: "gold_badge", name: "Gold Top Hat", colorHex: "#FFD700", type: "hat", description: "A gold hat worn on your head, plus a gold Ω name badge." },
  { id: "azure_badge", name: "Azure Crown", colorHex: "#3B9CFF", type: "hat", description: "An azure hat worn on your head, plus an azure Ω name badge." },
  { id: "crimson_cape", name: "Crimson Cape", colorHex: "#E63946", type: "cape", description: "A crimson cape flowing from your shoulders." },
  { id: "emerald_cape", name: "Emerald Cape", colorHex: "#2FBF71", type: "cape", description: "An emerald cape flowing from your shoulders." },
  { id: "phantom_wings", name: "Phantom Wings", colorHex: "#B48CFF", type: "wings", description: "Ethereal wings on your back." },
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
