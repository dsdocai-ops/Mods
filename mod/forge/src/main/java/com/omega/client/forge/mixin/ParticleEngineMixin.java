package com.omega.client.forge.mixin;

import com.omega.client.forge.ModConfig;
import com.omega.client.forge.particle.ParticleFilter;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Forge-side twin of the Fabric module's ParticleManagerMixin - same rationale (see "Particle
 * control" in mod/README.md), same single-choke-point strategy, different target: official
 * mappings' ParticleEngine#createParticle is the equivalent of Yarn's ParticleManager#addParticle.
 * This is the highest-risk guess this feature adds on the Forge side - both the exact method
 * signature (createParticle's generic <T extends ParticleOptions> erases to ParticleOptions in the
 * bytecode descriptor, which is what the injector targets below) and the Forge/Mixin Gradle wiring
 * in build.gradle/mods.toml are unverified against a real compile. See mod/README.md.
 *
 * Two entry points are covered, not one - see the Fabric ParticleManagerMixin's javadoc for why:
 * createParticle(ParticleOptions, ...) is the classifiable path, but a handful of vanilla effects
 * construct a Particle directly and hand it to add(Particle) instead, skipping the type lookup
 * entirely - that path only honors the master switch (it can't be classified by category), but
 * still has to be covered or "All particles: OFF" wouldn't actually mean *all* particles.
 * `ParticleEngine#add(Particle)`'s exact name is an additional guess on top of everything above.
 */
@Mixin(ParticleEngine.class)
public abstract class ParticleEngineMixin {
    @Inject(
            method = "createParticle(Lnet/minecraft/core/particles/ParticleOptions;DDDDDD)V",
            at = @At("HEAD"),
            cancellable = true
    )
    private void omega$filterParticle(ParticleOptions options, double x, double y, double z,
                                       double xSpeed, double ySpeed, double zSpeed, CallbackInfo ci) {
        ResourceLocation id = BuiltInRegistries.PARTICLE_TYPE.getKey(options.getType());
        if (!ParticleFilter.shouldSpawn(ModConfig.ACTIVE, id)) {
            ci.cancel();
        }
    }

    @Inject(
            method = "add(Lnet/minecraft/client/particle/Particle;)V",
            at = @At("HEAD"),
            cancellable = true
    )
    private void omega$filterConstructedParticle(Particle particle, CallbackInfo ci) {
        if (!ModConfig.ACTIVE.particlesMasterEnabled) {
            ci.cancel();
        }
    }
}
