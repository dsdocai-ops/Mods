// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.mixin;

import com.omega.client.ModConfig;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Forge-side twin of the Fabric WorldMixin (Clear Weather, client-visual only). Official
 * mappings: World -> Level, getRainGradient -> getRainLevel, getThunderGradient ->
 * getThunderLevel, isClient -> isClientSide - moderate confidence, see mod/README.md. The
 * isClientSide guard keeps the integrated server's real weather (crops, mobs, tridents,
 * lightning) untouched, same as the Fabric side.
 */
@Mixin(Level.class)
public abstract class LevelMixin {
    @Inject(method = "getRainLevel", at = @At("HEAD"), cancellable = true)
    private void omega$clearRain(float delta, CallbackInfoReturnable<Float> cir) {
        if (ModConfig.ACTIVE.clearWeatherEnabled && ((Level) (Object) this).isClientSide) {
            cir.setReturnValue(0.0F);
        }
    }

    @Inject(method = "getThunderLevel", at = @At("HEAD"), cancellable = true)
    private void omega$clearThunder(float delta, CallbackInfoReturnable<Float> cir) {
        if (ModConfig.ACTIVE.clearWeatherEnabled && ((Level) (Object) this).isClientSide) {
            cir.setReturnValue(0.0F);
        }
    }
}
