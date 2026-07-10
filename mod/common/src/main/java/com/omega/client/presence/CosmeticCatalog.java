// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.Map;

/**
 * Pure lookup table from a cosmetic id (ModConfig.ownedCosmeticId, broadcast over the presence
 * channel alongside a player's UUID - see OmegaPresence/PresenceNetworking) to its display data.
 * Zero Minecraft imports, same sharing rule as ParticleCategory - safe to compile once and use from
 * both loaders.
 *
 * A cosmetic is one of four kinds: a BADGE recolors the Ω nametag prefix (EntityRendererMixin);
 * HAT/CAPE/WINGS are gear rendered on the player model from CosmeticGeometry's vertex data
 * (CosmeticFeatureRenderer on Fabric, CosmeticRenderLayer on Forge). Every kind is described by
 * this same record - primaryRgb is the main surface, secondaryRgb the accent (hat band, cape
 * lining, wing ridge; for badges it just duplicates primary).
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
    /** What a cosmetic id renders as. BADGE = nametag recolor only; the rest are gear geometry. */
    public enum Kind { BADGE, HAT, CAPE, WINGS }

    /** One catalog entry. Plain data (record of primitives/enums) so it can cross the common/ boundary. */
    public record Cosmetic(String id, Kind kind, int primaryRgb, int secondaryRgb) {
    }

    /** The badge color every player (Omega or not) effectively has today - the "no cosmetic" case. */
    public static final int DEFAULT_BADGE_RGB = 0xE63946;

    // Map.of caps at 10 entries - switch to Map.ofEntries(Map.entry(...), ...) at the 11th cosmetic.
    private static final Map<String, Cosmetic> COSMETICS = Map.of(
            "gold_badge", new Cosmetic("gold_badge", Kind.BADGE, 0xFFD700, 0xFFD700),
            "azure_badge", new Cosmetic("azure_badge", Kind.BADGE, 0x3B9CFF, 0x3B9CFF),
            "crimson_cape", new Cosmetic("crimson_cape", Kind.CAPE, 0xC62839, 0xF4A261),
            "seraph_wings", new Cosmetic("seraph_wings", Kind.WINGS, 0xF2EFE6, 0xFFD700),
            "obsidian_top_hat", new Cosmetic("obsidian_top_hat", Kind.HAT, 0x241F31, 0xE63946)
    );

    private CosmeticCatalog() {
    }

    /** Null for an empty, unknown, or unrecognized cosmetic id. */
    public static Cosmetic get(String cosmeticId) {
        return cosmeticId == null ? null : COSMETICS.get(cosmeticId);
    }

    /**
     * The Ω nametag color for this id. Only BADGE cosmetics recolor the nametag - gear kinds keep
     * the default red (their identity lives on the player model, and a hat's primary can be near-
     * black, which would be unreadable on the nametag plate). Falls back to the default red for an
     * empty, unknown, or unrecognized cosmetic id.
     */
    public static int colorFor(String cosmeticId) {
        Cosmetic cosmetic = get(cosmeticId);
        if (cosmetic == null || cosmetic.kind() != Kind.BADGE) return DEFAULT_BADGE_RGB;
        return cosmetic.primaryRgb();
    }

    public static boolean isKnown(String cosmeticId) {
        return cosmeticId != null && COSMETICS.containsKey(cosmeticId);
    }
}
