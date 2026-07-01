package com.omega.client.particle;

import java.util.Set;

/**
 * Classifies vanilla particle type ids (namespace + path, e.g. "minecraft" + "totem_of_undying")
 * into the coarse categories the particle-control feature toggles independently. Pure string
 * logic, zero Minecraft imports - safe to share between the Fabric and Forge modules the same way
 * SchematicData/SessionInfo are, see SessionInfo's javadoc. Takes namespace/path separately
 * instead of a single "namespace:path" string so callers can pass Identifier/ResourceLocation's
 * already-stored fields directly without allocating a new string on every particle spawn.
 */
public final class ParticleCategory {
    private ParticleCategory() {
    }

    public enum Category {
        BLOCK,
        AMBIENT,
        TOTEM,
        CRIT,
        EXPLOSION,
        PORTAL,
        OTHER
    }

    /** The generic block-break/step/land particle plus its close relatives - "particles for every block". */
    private static final Set<String> BLOCK_PATHS = Set.of(
            "block", "block_marker", "falling_dust", "dust_plume"
    );

    private static final Set<String> TOTEM_PATHS = Set.of("totem_of_undying");

    private static final Set<String> CRIT_PATHS = Set.of("crit", "enchanted_hit");

    private static final Set<String> EXPLOSION_PATHS = Set.of("explosion", "explosion_emitter");

    private static final Set<String> PORTAL_PATHS = Set.of("portal", "reverse_portal");

    /** Ambient decorations tied to blocks that aren't the generic break/step particle - smoke, drips, spores, etc. */
    private static final Set<String> AMBIENT_PATHS = Set.of(
            "smoke", "large_smoke", "flame", "small_flame",
            "dripping_water", "dripping_lava", "dripping_honey",
            "falling_water", "falling_lava", "falling_honey",
            "landing_lava", "landing_honey",
            "campfire_cosy_smoke", "campfire_signal_smoke",
            "composter", "dust", "dust_color_transition", "mycelium",
            "spore_blossom_air", "warped_spore", "crimson_spore",
            "ash", "white_ash", "sculk_soul", "sculk_charge_pop",
            "bubble_column_up", "bubble_pop", "current_down",
            "nautilus", "cherry_leaves"
    );

    public static Category classify(String namespace, String path) {
        if (!"minecraft".equals(namespace) || path == null) return Category.OTHER;
        if (BLOCK_PATHS.contains(path)) return Category.BLOCK;
        if (TOTEM_PATHS.contains(path)) return Category.TOTEM;
        if (CRIT_PATHS.contains(path)) return Category.CRIT;
        if (EXPLOSION_PATHS.contains(path)) return Category.EXPLOSION;
        if (PORTAL_PATHS.contains(path)) return Category.PORTAL;
        if (AMBIENT_PATHS.contains(path)) return Category.AMBIENT;
        return Category.OTHER;
    }
}
