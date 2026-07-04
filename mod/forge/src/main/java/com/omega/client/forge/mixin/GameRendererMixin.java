// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.mixin;

import com.omega.client.ModConfig;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Forge-side twin of the Fabric GameRendererMixin (No Hurt Camera). Official-mappings name for
 * Yarn's tiltViewWhenHurt is bobHurt - moderate confidence, see mod/README.md. Same trick as the
 * Fabric side: the handler captures no args, so only the method name has to be right.
 */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "bobHurt", at = @At("HEAD"), cancellable = true)
    private void omega$noHurtCam(CallbackInfo ci) {
        if (ModConfig.ACTIVE.noHurtCamEnabled) {
            ci.cancel();
        }
    }
}
