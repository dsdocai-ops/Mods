// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

/**
 * Pure lookup table from a cosmetic id (ModConfig.ownedCosmeticId, broadcast over the presence
 * channel alongside a player's UUID - see OmegaPresence/PresenceNetworking) to its display data.
 * Zero Minecraft imports, same sharing rule as ParticleCategory - safe to compile once and use from
 * both loaders. Also backs the in-game Cosmetics screen's click-to-cycle button (see CosmeticsScreen
 * in each loader module), the same click-to-cycle-value pattern VisualScreenSupport uses for the
 * highlight color.
 *
 * Cosmetic ownership is self-reported by each client (the mod only ever reads its own config file),
 * the same trust model every other toggle in this app already uses - a user who hand-edits their
 * config can grant themselves a cosmetic without paying, same as they already could with any other
 * flag. Proportionate to a vanity-only feature; not something this class tries to harden. The
 * in-game Cosmetics screen cycles through every entry here rather than only ones actually redeemed
 * for the same reason: there is no separate "owned list" synced into the mod today (only the single
 * currently-equipped ownedCosmeticId, written by the launcher's redeem flow), so gating the picker
 * would need to hold back the id you *did* pay for equally as often as one you didn't.
 *
 * Starts with placeholder ids so the broadcast/render pipeline is real and testable end to end -
 * actual cosmetic art/copy is a content decision, not a blocker for the pipeline itself.
 */
public final class CosmeticCatalog {
    /** The badge color every player (Omega or not) effectively has today - the "no cosmetic" case. */
    public static final int DEFAULT_BADGE_RGB = 0xE63946;

    private record Cosmetic(String id, String label, int rgb) {
    }

    /** Ordered (not a Map) so the Cosmetics screen's cycle button has a stable, repeatable sequence. "" (None) comes first. */
    private static final Cosmetic[] COSMETICS = {
            new Cosmetic("", "None", DEFAULT_BADGE_RGB),
            new Cosmetic("gold_badge", "Gold Badge", 0xFFD700),
            new Cosmetic("azure_badge", "Azure Badge", 0x3B9CFF),
    };

    private CosmeticCatalog() {
    }

    /** Falls back to the default red for an empty, unknown, or unrecognized cosmetic id. */
    public static int colorFor(String cosmeticId) {
        int index = indexOf(cosmeticId);
        return index < 0 ? DEFAULT_BADGE_RGB : COSMETICS[index].rgb();
    }

    public static boolean isKnown(String cosmeticId) {
        return cosmeticId != null && !cosmeticId.isEmpty() && indexOf(cosmeticId) >= 0;
    }

    /** Human-readable label for a cosmetic id, e.g. for the Cosmetics screen's button text; "None" for empty/unrecognized. */
    public static String labelFor(String cosmeticId) {
        int index = indexOf(cosmeticId);
        return index < 0 ? COSMETICS[0].label() : COSMETICS[index].label();
    }

    /** Steps to the next cosmetic id, wrapping back to "" (None) once the last entry is passed. */
    public static String nextCosmeticId(String currentId) {
        int index = indexOf(currentId);
        return COSMETICS[(Math.max(index, 0) + 1) % COSMETICS.length].id();
    }

    private static int indexOf(String cosmeticId) {
        String normalized = cosmeticId == null ? "" : cosmeticId;
        for (int i = 0; i < COSMETICS.length; i++) {
            if (COSMETICS[i].id().equals(normalized)) return i;
        }
        return -1;
    }
}
