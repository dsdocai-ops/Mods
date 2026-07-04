// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.mixin;

import com.mojang.blaze3d.systems.RenderSystem;
import com.omega.client.ModConfig;
import net.minecraft.client.render.BackgroundRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * No Fog: runs AFTER vanilla's fog setup and pushes both fog planes out to infinity, rather than
 * cancelling the method - cancelling would leave whatever start/end the previous frame set (and
 * would also skip fog-color work other mods may hook). Overriding at RETURN kills terrain, water,
 * lava and nether fog alike with one rule and zero interference.
 *
 * Handler is static because the target is (applyFog is a static utility on BackgroundRenderer),
 * and captures no args so only the method name has to match the mappings.
 */
@Mixin(BackgroundRenderer.class)
public abstract class BackgroundRendererMixin {
    @Inject(method = "applyFog", at = @At("RETURN"))
    private static void omega$noFog(CallbackInfo ci) {
        if (ModConfig.ACTIVE.noFogEnabled) {
            RenderSystem.setShaderFogStart(Float.MAX_VALUE);
            RenderSystem.setShaderFogEnd(Float.MAX_VALUE);
        }
    }
}
