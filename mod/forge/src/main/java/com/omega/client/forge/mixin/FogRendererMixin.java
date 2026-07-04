// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.mixin;

import com.mojang.blaze3d.systems.RenderSystem;
import com.omega.client.ModConfig;
import net.minecraft.client.renderer.FogRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Forge-side twin of the Fabric BackgroundRendererMixin (No Fog): runs AFTER vanilla's fog setup
 * and pushes both fog planes out to infinity rather than cancelling (see the Fabric class for the
 * rationale). Official mappings: BackgroundRenderer.applyFog -> FogRenderer.setupFog - moderate
 * confidence, see mod/README.md. Handler is static because the target method is.
 */
@Mixin(FogRenderer.class)
public abstract class FogRendererMixin {
    @Inject(method = "setupFog", at = @At("RETURN"))
    private static void omega$noFog(CallbackInfo ci) {
        if (ModConfig.ACTIVE.noFogEnabled) {
            RenderSystem.setShaderFogStart(Float.MAX_VALUE);
            RenderSystem.setShaderFogEnd(Float.MAX_VALUE);
        }
    }
}
