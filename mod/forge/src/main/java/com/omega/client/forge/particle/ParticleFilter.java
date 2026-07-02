package com.omega.client.forge.particle;

import com.omega.client.forge.ModConfig;
import com.omega.client.particle.ParticleCategory;
import net.minecraft.resources.ResourceLocation;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Forge-side twin of the Fabric module's ParticleFilter - same decision logic, ResourceLocation
 * (official mappings) instead of Identifier (Yarn). Called from ParticleEngineMixin on every
 * particle spawn, so this is a hot path: no allocation unless the user has actually configured a
 * blacklist (particleId.toString() is only called then).
 */
public final class ParticleFilter {
    private ParticleFilter() {
    }

    public static boolean shouldSpawn(ModConfig config, ResourceLocation particleId) {
        if (!config.particlesMasterEnabled) return false;
        if (particleId == null) return true;

        ParticleCategory.Category category = ParticleCategory.classify(particleId.getNamespace(), particleId.getPath());
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

        if (!config.particleBlacklist.isEmpty() && config.particleBlacklist.contains(particleId.toString())) {
            return false;
        }

        if (config.particleDensity < 1f) {
            return ThreadLocalRandom.current().nextFloat() < config.particleDensity;
        }
        return true;
    }
}
