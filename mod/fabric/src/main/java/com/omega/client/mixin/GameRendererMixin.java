// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.mixin;

import com.omega.client.ModConfig;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * No Hurt Camera: cancels the view tilt vanilla applies while the player has hurt-time. Visual
 * comfort only - damage, knockback and the red flash all still happen; this skips just the camera
 * roll, which many PvP players find disorienting mid-fight.
 *
 * The handler takes only CallbackInfo (no captured args) on purpose, so only the method NAME has
 * to be right, not the parameter list - one less mapping guess for CI to reject.
 */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "tiltViewWhenHurt", at = @At("HEAD"), cancellable = true)
    private void omega$noHurtCam(CallbackInfo ci) {
        if (ModConfig.ACTIVE.noHurtCamEnabled) {
            ci.cancel();
        }
    }
}
