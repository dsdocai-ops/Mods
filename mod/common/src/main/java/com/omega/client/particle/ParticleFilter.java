package com.omega.client.particle;

import com.omega.client.ModConfig;

import java.util.concurrent.ThreadLocalRandom;

/**
 * The actual per-spawn decision behind the particle-control feature - called from the loader's own
 * particle Mixin on every single particle spawn, so this is a hot path: no allocation unless the
 * user has actually configured a blacklist (the full "namespace:path" id string is only built then).
 *
 * Takes namespace/path as separate strings instead of Identifier/ResourceLocation - those types
 * differ in package *and* class name between Yarn and official mappings (unlike e.g. BlockPos,
 * which is just a different package), so a public parameter typed either one would hit the same
 * cross-module compile problem documented on InfoHudFeature. The calling Mixin (necessarily
 * loader-specific already) extracts namespace/path from its own Identifier/ResourceLocation before
 * calling in - "namespace:path" is the same standard string format on both mapping sets, so
 * building it here instead of receiving toString() from outside changes nothing.
 */
public final class ParticleFilter {
    private ParticleFilter() {
    }

    public static boolean shouldSpawn(ModConfig config, String namespace, String path) {
        if (!config.particlesMasterEnabled) return false;
        if (namespace == null || path == null) return true;

        ParticleCategory.Category category = ParticleCategory.classify(namespace, path);
        switch (category) {
            case BLOCK:
                if (!config.blockParticlesEnabled) return false;
                break;
            case AMBIENT:
                if (!config.ambientParticlesEnabled) return false;
                break;
            case TOTEM:
                if (!config.totemParticlesEnabled) return false;
                break;
            case CRIT:
                if (!config.critParticlesEnabled) return false;
                break;
            case EXPLOSION:
                if (!config.explosionParticlesEnabled) return false;
                break;
            case PORTAL:
                if (!config.portalParticlesEnabled) return false;
                break;
            default:
                break;
        }

        if (!config.particleBlacklist.isEmpty() && config.particleBlacklist.contains(namespace + ":" + path)) {
            return false;
        }

        if (config.particleDensity < 1f) {
            return ThreadLocalRandom.current().nextFloat() < config.particleDensity;
        }
        return true;
    }
}
