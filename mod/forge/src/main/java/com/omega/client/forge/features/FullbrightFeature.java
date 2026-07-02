package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import net.minecraft.client.Minecraft;

/**
 * Forge-side twin of the Fabric FullbrightFeature - same technique (write past the options
 * screen's UI-enforced gamma clamp), translated to Mojang's official mappings: `Minecraft` instead
 * of Yarn's `MinecraftClient`, and `options.gamma()` - CI's first real compile corrected the
 * original direct-field guess (the field is private; official mappings expose an accessor method
 * returning the OptionInstance, same shape as Yarn's `getGamma()`).
 */
public final class FullbrightFeature {
    private double savedGamma = 1.0;
    private boolean applied = false;

    public void tick(ModConfig config) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        if (config.fullbrightEnabled && !applied) {
            savedGamma = client.options.gamma().get();
            client.options.gamma().set(15.0d);
            applied = true;
        } else if (!config.fullbrightEnabled && applied) {
            client.options.gamma().set(savedGamma);
            applied = false;
        }
    }
}
