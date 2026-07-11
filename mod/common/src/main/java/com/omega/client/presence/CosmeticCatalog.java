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
 * carries just badgeRgb; HAT/CAPE/WINGS render as gear on the player model, one of two ways -
 * PROCEDURAL (art != null): pixel art (CosmeticPixelArt) extruded into solid-color quads like a
 * Minecraft item texture (CosmeticGeometry) - colors live entirely in the art's palette; or
 * TEXTURED (textureId != null, CAPE only for now): a real PNG UV-mapped onto cloth-like strips
 * (CosmeticTexturedMesh) - colors live in the image, not in this catalog. Exactly one of art/
 * textureId is non-null for any HAT/CAPE/WINGS entry; both renderers (CosmeticFeatureRenderer on
 * Fabric, CosmeticRenderLayer on Forge) branch on which is set.
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
     * for BADGE kinds (gear keeps the default nametag red); art is the pixel grid for a PROCEDURAL
     * gear cosmetic, null for badges and for TEXTURED gear. trailColor is an opt-in per-cosmetic
     * choice (null = no trail, RGB otherwise) - only CAPE/WINGS ever emit one (see
     * CosmeticGeometry.tipPointsFor: HAT/BADGE have no tip to trail from, so a trailColor there
     * would silently never fire; leave it null for those kinds rather than setting a color that
     * does nothing). textureId is null for procedural/badge cosmetics; for a TEXTURED cape it's the
     * path under textures/ WITHOUT the "cosmetics/" segment or ".png" extension already baked in -
     * e.g. "cosmetics/starlit_cape" resolves to textures/cosmetics/starlit_cape.png in both
     * loaders' resource trees (mod/fabric/.../assets/omega-client/, mod/forge/.../assets/
     * omega_client_forge/ - the same file, duplicated, same convention as every other per-loader
     * resource in this project. See CosmeticTexturedMesh's class doc for why CAPE only, for now.
     */
    public record Cosmetic(String id, Kind kind, int badgeRgb, CosmeticPixelArt.PixelArt art, Integer trailColor, String textureId) {
    }

    /** The badge color every player (Omega or not) effectively has today - the "no cosmetic" case. */
    public static final int DEFAULT_BADGE_RGB = 0xE63946;

    // Map.of caps at 10 entries - switch to Map.ofEntries(Map.entry(...), ...) at the 11th cosmetic.
    private static final Map<String, Cosmetic> COSMETICS = Map.of(
            "gold_badge", new Cosmetic("gold_badge", Kind.BADGE, 0xFFD700, null, null, null),
            "azure_badge", new Cosmetic("azure_badge", Kind.BADGE, 0x3B9CFF, null, null, null),
            "crimson_cape", new Cosmetic("crimson_cape", Kind.CAPE, DEFAULT_BADGE_RGB, CosmeticPixelArt.CRIMSON_CAPE, 0xFFD700, null),
            "nightfall_cape", new Cosmetic("nightfall_cape", Kind.CAPE, DEFAULT_BADGE_RGB, CosmeticPixelArt.NIGHTFALL_CAPE, 0xC9B8F0, null),
            "seraph_wings", new Cosmetic("seraph_wings", Kind.WINGS, DEFAULT_BADGE_RGB, CosmeticPixelArt.SERAPH_WINGS, 0xFFFFFF, null),
            "obsidian_top_hat", new Cosmetic("obsidian_top_hat", Kind.HAT, DEFAULT_BADGE_RGB, CosmeticPixelArt.OBSIDIAN_TOP_HAT, null, null),
            "navy_captain_hat", new Cosmetic("navy_captain_hat", Kind.HAT, DEFAULT_BADGE_RGB, CosmeticPixelArt.NAVY_CAPTAIN_HAT, null, null),
            "starlit_cape", new Cosmetic("starlit_cape", Kind.CAPE, DEFAULT_BADGE_RGB, null, 0xB39DDB, "cosmetics/starlit_cape"),
            "eclipse_cape", new Cosmetic("eclipse_cape", Kind.CAPE, DEFAULT_BADGE_RGB, null, 0xFFA050, "cosmetics/eclipse_cape")
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
