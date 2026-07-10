// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.Collection;
import java.util.Map;

/**
 * Pure lookup table from a cosmetic id (ModConfig.ownedCosmeticId, broadcast over the presence
 * channel alongside a player's UUID - see OmegaPresence/PresenceNetworking) to its display data.
 * Zero Minecraft imports, same sharing rule as ParticleCategory - safe to compile once and use from
 * both loaders.
 *
 * A cosmetic is one of four kinds: a BADGE recolors the Ω nametag prefix (EntityRendererMixin) and
 * carries just badgeRgb; HAT/CAPE/WINGS are pixel art (CosmeticPixelArt) extruded onto the player
 * model like a Minecraft item texture (CosmeticGeometry; drawn by CosmeticFeatureRenderer on
 * Fabric, CosmeticRenderLayer on Forge) - their colors live entirely in the art's palette.
 *
 * Cosmetic ownership is self-reported by each client (the mod only ever reads its own config file),
 * the same trust model every other toggle in this app already uses - a user who hand-edits their
 * config can grant themselves a cosmetic without paying, same as they already could with any other
 * flag. Proportionate to a vanity-only feature; not something this class tries to harden.
 *
 * Starts with placeholder ids covering every kind so the broadcast/render pipeline is real and
 * testable end to end - actual cosmetic art/copy is a content decision, not a blocker for the
 * pipeline itself. The id list is mirrored by hand in src/shared/cosmetics.ts and
 * scripts/generate-license-key.cjs - keep all three in sync (see the generate-cosmetic skill).
 */
public final class CosmeticCatalog {
    /** What a cosmetic id renders as. BADGE = nametag recolor only; the rest are extruded pixel art. */
    public enum Kind { BADGE, HAT, CAPE, WINGS }

    /**
     * One catalog entry - plain data so it can cross the common/ boundary. badgeRgb is only read
     * for BADGE kinds (gear keeps the default nametag red); art is null for badges and the pixel
     * grid for gear.
     */
    public record Cosmetic(String id, Kind kind, int badgeRgb, CosmeticPixelArt.PixelArt art) {
    }

    /** The badge color every player (Omega or not) effectively has today - the "no cosmetic" case. */
    public static final int DEFAULT_BADGE_RGB = 0xE63946;

    // Map.of caps at 10 entries - switch to Map.ofEntries(Map.entry(...), ...) at the 11th cosmetic.
    private static final Map<String, Cosmetic> COSMETICS = Map.of(
            "gold_badge", new Cosmetic("gold_badge", Kind.BADGE, 0xFFD700, null),
            "azure_badge", new Cosmetic("azure_badge", Kind.BADGE, 0x3B9CFF, null),
            "crimson_cape", new Cosmetic("crimson_cape", Kind.CAPE, DEFAULT_BADGE_RGB, CosmeticPixelArt.CRIMSON_CAPE),
            "seraph_wings", new Cosmetic("seraph_wings", Kind.WINGS, DEFAULT_BADGE_RGB, CosmeticPixelArt.SERAPH_WINGS),
            "obsidian_top_hat", new Cosmetic("obsidian_top_hat", Kind.HAT, DEFAULT_BADGE_RGB, CosmeticPixelArt.OBSIDIAN_TOP_HAT),
            "navy_captain_hat", new Cosmetic("navy_captain_hat", Kind.HAT, DEFAULT_BADGE_RGB, CosmeticPixelArt.NAVY_CAPTAIN_HAT)
    );

    private CosmeticCatalog() {
    }

    /** Null for an empty, unknown, or unrecognized cosmetic id. */
    public static Cosmetic get(String cosmeticId) {
        return cosmeticId == null ? null : COSMETICS.get(cosmeticId);
    }

    /** Every catalog entry, unordered - for tooling (the generate-cosmetic skill's dumper) and future UI. */
    public static Collection<Cosmetic> all() {
        return COSMETICS.values();
    }

    /**
     * The Ω nametag color for this id. Only BADGE cosmetics recolor the nametag - gear kinds keep
     * the default red (their identity lives on the player model, and gear palettes can be near-
     * black, which would be unreadable on the nametag plate). Falls back to the default red for an
     * empty, unknown, or unrecognized cosmetic id.
     */
    public static int colorFor(String cosmeticId) {
        Cosmetic cosmetic = get(cosmeticId);
        if (cosmetic == null || cosmetic.kind() != Kind.BADGE) return DEFAULT_BADGE_RGB;
        return cosmetic.badgeRgb();
    }

    public static boolean isKnown(String cosmeticId) {
        return cosmeticId != null && COSMETICS.containsKey(cosmeticId);
    }
}
