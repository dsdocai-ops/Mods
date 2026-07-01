package com.omega.client.mixin;

import com.omega.client.ModConfig;
import com.omega.client.particle.ParticleFilter;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleManager;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * The one deliberate exception to this mod's normal zero-Mixin approach - see "Particle control"
 * in mod/README.md for the full rationale. There is no documented Fabric API event for cancelling
 * a particle spawn by type, and every non-Mixin alternative (replacing MinecraftClient's
 * particleManager instance, or reflectively wrapping its registered factories) is strictly more
 * fragile: both depend on reproducing or racing against internal state that gets rebuilt on every
 * resource reload. A single HEAD injection into the one real choke point - every particle spawn in
 * the game funnels through ParticleManager#addParticle - is the smaller, more standard risk.
 *
 * Two entry points are covered, not one: addParticle(ParticleEffect, ...) is the normal path
 * (factory looked up by type, everything ParticleFilter's category logic can classify), but a
 * handful of vanilla effects (e.g. particles that spawn their own child particles from tick())
 * construct a Particle object directly and hand it to addParticle(Particle) instead, skipping the
 * type lookup entirely. That path can't be classified by category (a constructed Particle doesn't
 * carry its originating ParticleEffect), so it only honors the master switch - but it has to be
 * covered too, or "All particles: OFF" wouldn't actually mean *all* particles.
 */
@Mixin(ParticleManager.class)
public abstract class ParticleManagerMixin {
    @Inject(
            method = "addParticle(Lnet/minecraft/particle/ParticleEffect;DDDDDD)V",
            at = @At("HEAD"),
            cancellable = true
    )
    private void omega$filterParticle(ParticleEffect parameters, double x, double y, double z,
                                       double velocityX, double velocityY, double velocityZ, CallbackInfo ci) {
        Identifier id = Registries.PARTICLE_TYPE.getId(parameters.getType());
        if (!ParticleFilter.shouldSpawn(ModConfig.ACTIVE, id)) {
            ci.cancel();
        }
    }

    @Inject(
            method = "addParticle(Lnet/minecraft/client/particle/Particle;)V",
            at = @At("HEAD"),
            cancellable = true
    )
    private void omega$filterConstructedParticle(Particle particle, CallbackInfo ci) {
        if (!ModConfig.ACTIVE.particlesMasterEnabled) {
            ci.cancel();
        }
    }
}
