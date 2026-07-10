// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.Map;

/**
 * Pure lookup table from a cosmetic id (ModConfig.ownedCosmeticId, broadcast over the presence
 * channel alongside a player's UUID - see OmegaPresence/PresenceNetworking) to its display data.
 * colorFor() drives two things now: the Ω name-badge tint (EntityRendererMixin) and the worn hat
 * cosmetic (HatRenderer, per loader). Zero Minecraft imports, same sharing rule as ParticleCategory -
 * safe to compile once and use from both loaders.
 *
 * Cosmetic ownership is self-reported by each client (the mod only ever reads its own config file),
 * the same trust model every other toggle in this app already uses - a user who hand-edits their
 * config can grant themselves a cosmetic without paying, same as they already could with any other
 * flag. Proportionate to a vanity-only feature; not something this class tries to harden.
 *
 * Starts with placeholder ids so the broadcast/render pipeline is real and testable end to end -
 * actual cosmetic art/copy is a content decision, not a blocker for the pipeline itself.
 */
public final class CosmeticCatalog {
    /** The badge color every player (Omega or not) effectively has today - the "no cosmetic" case. */
    public static final int DEFAULT_BADGE_RGB = 0xE63946;

    private static final Map<String, Integer> BADGE_COLORS = Map.of(
            "gold_badge", 0xFFD700,
            "azure_badge", 0x3B9CFF
    );

    private CosmeticCatalog() {
    }

    /** Falls back to the default red for an empty, unknown, or unrecognized cosmetic id. */
    public static int colorFor(String cosmeticId) {
        if (cosmeticId == null || cosmeticId.isEmpty()) return DEFAULT_BADGE_RGB;
        return BADGE_COLORS.getOrDefault(cosmeticId, DEFAULT_BADGE_RGB);
    }

    public static boolean isKnown(String cosmeticId) {
        return cosmeticId != null && BADGE_COLORS.containsKey(cosmeticId);
    }
}
