// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.platform;

import com.omega.client.ModConfig;
import com.omega.client.particle.ParticleFilter;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.OmegaPresence;

import java.util.UUID;

/**
 * The version- and loader-agnostic decision layer every game-&gt;mod hook funnels through.
 *
 * <p>The multi-version architecture (see mod/README.md's "Multi-version architecture" section)
 * splits the mod into two kinds of code:
 *
 * <ul>
 *   <li><b>Core</b> ({@code common/}) - feature logic that never touches version-volatile Minecraft
 *       internals. Compiles once against official mappings, remapped per loader by Loom.
 *   <li><b>Injection points</b> - the Mixins in the Fabric and Forge {@code mixin} packages: the thin,
 *       inherently version- and loader-specific glue that catches a game event and forwards it here.
 *       These are the only files that must be re-authored (or overlaid) for a new Minecraft version,
 *       because they name obfuscated methods/classes the mappings rename between versions.
 * </ul>
 *
 * <p>This class is the seam between the two. Every method here obeys one hard rule that makes it
 * callable identically from a Yarn-mapped Fabric mixin and a Mojmap-mapped Forge mixin: <b>it takes
 * and returns only cross-mapping-safe types</b> - JDK types ({@code UUID}, {@code String},
 * {@code int}, {@code boolean}) and mod-owned types - never a Minecraft class. A mixin extracts the
 * plain values it needs from the (mapping-specific) Minecraft objects it was handed, calls in here
 * for the decision, and applies the result back onto those objects. That keeps every actual
 * <em>decision</em> in one place, deduplicated across loaders, and leaves each mixin as little more
 * than an injection coordinate.
 */
public final class OmegaHooks {
    private OmegaHooks() {
    }

    /**
     * Sentinel returned by {@link #nametagBadgeColor(UUID)} meaning "draw no badge". Not a valid
     * 24-bit RGB value, so it can never collide with a real badge color.
     */
    public static final int NO_BADGE = Integer.MIN_VALUE;

    /** No Hurt Camera: whether the view-tilt-on-hurt should be suppressed. */
    public static boolean noHurtCam() {
        return ModConfig.ACTIVE.noHurtCamEnabled;
    }

    /** No Fog: whether both fog planes should be pushed to infinity after vanilla sets fog up. */
    public static boolean noFog() {
        return ModConfig.ACTIVE.noFogEnabled;
    }

    /**
     * Clear Weather (visual): whether client-side rain/thunder gradients should read as zero. The
     * caller still has to guard on the world being client-side - that's a Minecraft-object check
     * that stays in the mixin, since only the config gate is version-agnostic.
     */
    public static boolean clearWeather() {
        return ModConfig.ACTIVE.clearWeatherEnabled;
    }

    /** Master particle switch: false means suppress every particle spawn regardless of category. */
    public static boolean particlesMasterOn() {
        return ModConfig.ACTIVE.particlesMasterEnabled;
    }

    /**
     * Whether a particle of the given registry id should be allowed to spawn, honoring the master
     * switch and per-category filters. A null/blank namespace or path is treated as "always spawn"
     * (see {@link ParticleFilter}), so a caller that couldn't resolve a registry id can pass through
     * safely rather than having to special-case it.
     */
    public static boolean shouldSpawnParticle(String namespace, String path) {
        return ParticleFilter.shouldSpawn(ModConfig.ACTIVE, namespace, path);
    }

    /**
     * The Ω name-badge color (ARGB) for a player, or {@link #NO_BADGE} if none should be drawn -
     * either the feature is off, or the player isn't a known Omega Client user. This is the whole
     * badge <em>decision</em>; the caller only has to wrap the returned color into that version's
     * text type (Yarn {@code Text} / Mojmap {@code Component}), the one genuinely mapping-specific
     * step.
     */
    public static int nametagBadgeColor(UUID playerUuid) {
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return NO_BADGE;
        if (!OmegaPresence.isOmegaUser(playerUuid)) return NO_BADGE;
        return CosmeticCatalog.colorFor(OmegaPresence.cosmeticOf(playerUuid));
    }

    /**
     * Whether a worn cosmetic of the given kind should be drawn for this wearer - the master switch,
     * self/others split, and per-kind toggles (set via the in-game Cosmetics... screen), all opt-out
     * and all default on. Deliberately independent of {@link #nametagBadgeColor}/showOmegaUsersEnabled:
     * that toggle only gates the nametag Ω prefix (and, in PresenceNetworking, whether you broadcast
     * your own presence at all) - once someone IS visible as an Omega user, whether their gear
     * actually renders is this separate opt-out group's call.
     */
    public static boolean shouldRenderCosmetic(boolean isSelf, CosmeticCatalog.Kind kind) {
        if (!ModConfig.ACTIVE.cosmeticsMasterEnabled) return false;
        if (isSelf ? !ModConfig.ACTIVE.showOwnCosmeticsEnabled : !ModConfig.ACTIVE.showOthersCosmeticsEnabled) return false;
        return switch (kind) {
            case HAT -> ModConfig.ACTIVE.hatCosmeticsEnabled;
            case CAPE -> ModConfig.ACTIVE.capeCosmeticsEnabled;
            case WINGS -> ModConfig.ACTIVE.wingsCosmeticsEnabled;
            case BADGE -> true; // no visibility toggle for the badge itself - see nametagBadgeColor
        };
    }
}
