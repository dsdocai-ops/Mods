// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.mixin;

import com.omega.client.ModConfig;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Clear Weather (visual): reports a zero rain/thunder gradient so the renderer draws no rain,
 * no darkened sky, and plays no rain ambience. Targets World (where the gradient getters live)
 * but guards on isClient, so the integrated server's ServerWorld keeps real weather - crop
 * hydration, mob spawning, tridents and lightning behave exactly as the server decides. This is
 * cosmetic-only by construction, same rule as everything else in this mod.
 */
@Mixin(World.class)
public abstract class WorldMixin {
    @Inject(method = "getRainGradient", at = @At("HEAD"), cancellable = true)
    private void omega$clearRain(float delta, CallbackInfoReturnable<Float> cir) {
        if (ModConfig.ACTIVE.clearWeatherEnabled && ((World) (Object) this).isClient) {
            cir.setReturnValue(0.0F);
        }
    }

    @Inject(method = "getThunderGradient", at = @At("HEAD"), cancellable = true)
    private void omega$clearThunder(float delta, CallbackInfoReturnable<Float> cir) {
        if (ModConfig.ACTIVE.clearWeatherEnabled && ((World) (Object) this).isClient) {
            cir.setReturnValue(0.0F);
        }
    }
}
