// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/**
 * Mirrors CosmeticCatalog.Kind (mod/common/.../presence/CosmeticCatalog.java) - BADGE recolors only
 * the Ω nametag prefix (no gear); HAT/CAPE/WINGS render gear on the player model. Kept as its own
 * type (not reused from elsewhere) since it's the launcher-UI grouping key for the Cosmetics page.
 */
export type CosmeticType = "badge" | "hat" | "cape" | "wings";

export const COSMETIC_TYPE_LABELS: Record<CosmeticType, string> = {
  badge: "Badges",
  hat: "Hats",
  cape: "Capes",
  wings: "Wings",
};

/**
 * One purchasable cosmetic, worn on the player in-game (and, for a BADGE, tinting the Ω name badge).
 * `id`/`type` must exist in mod/common/.../presence/CosmeticCatalog.java's COSMETICS map - the Java
 * side is the actual source of truth for rendering (art/geometry/texture); everything here
 * (name/colorHex/description) is launcher-UI only, a display layer over the same ids. Ownership is
 * per-cosmetic (see main/licensing.ts), not per-slot - a player wears at most one cosmetic overall
 * (ModConfig.ownedCosmeticId), set automatically the moment a license key redeems.
 */
export interface Cosmetic {
  id: string;
  name: string;
  /** Color as CSS hex - a representative swatch color for the launcher card, not read by the mod. */
  colorHex: string;
  type: CosmeticType;
  description: string;
}

/**
 * The cosmetic catalog, mirrored against mod/common/.../presence/CosmeticCatalog.java (same mirror
 * convention as ModConfig defaults in main/modConfig.ts) - keep ids and kinds in lockstep with that
 * file (and with scripts/generate-license-key.cjs's own id list) whenever a cosmetic is added; see
 * the generate-cosmetic skill.
 */
export const COSMETIC_CATALOG: Cosmetic[] = [
  { id: "gold_badge", name: "Gold Badge", colorHex: "#FFD700", type: "badge", description: "A gold Ω badge next to your name in-game." },
  { id: "azure_badge", name: "Azure Badge", colorHex: "#3B9CFF", type: "badge", description: "An azure Ω badge next to your name in-game." },
  { id: "crimson_cape", name: "Crimson Cape", colorHex: "#C62839", type: "cape", description: "A crimson cape trimmed in gold, with a gold Ω emblem and a fringed hem." },
  { id: "nightfall_cape", name: "Nightfall Cape", colorHex: "#4C2D99", type: "cape", description: "A midnight cape scattered with stars, rising into a purple flame gradient." },
  { id: "seraph_wings", name: "Seraph Wings", colorHex: "#F2EFE6", type: "wings", description: "Layered white feather wings with a gold top ridge." },
  { id: "obsidian_top_hat", name: "Obsidian Top Hat", colorHex: "#241F31", type: "hat", description: "A dark top hat with a brand-red band." },
  { id: "navy_captain_hat", name: "Navy Captain's Hat", colorHex: "#1B2A49", type: "hat", description: "A peaked officer's cap with a gold band and white emblem." },
  { id: "starlit_cape", name: "Starlit Cape", colorHex: "#B39DDB", type: "cape", description: "A real painted texture cape of a starlit night sky." },
  { id: "eclipse_cape", name: "Eclipse Cape", colorHex: "#FFA050", type: "cape", description: "A real painted texture cape of a solar eclipse." },
  { id: "inferno_wings", name: "Inferno Wings", colorHex: "#FF6B4A", type: "wings", description: "Dragon-like wings with an ember-to-shadow membrane gradient." },
  { id: "azure_charm_hat", name: "Azure Charm Hat", colorHex: "#34689E", type: "hat", description: "A true-3D voxel bucket hat with a gold fish charm dangling from a chain." },
  { id: "twilight_summit_cape", name: "Twilight Summit Cape", colorHex: "#CFE8FF", type: "cape", description: "A real painted texture cape of a starry sky over icy mountain peaks." },
  { id: "molten_crown_hat", name: "Molten Crown", colorHex: "#FF7A1A", type: "hat", description: "A true-3D voxel king's crown with 6 alternating tall/short spikes in a cooling-lava gradient from pale flame tips to a near-black base, a dark trim, and a gold band set with a bold ember gem." },
];

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
