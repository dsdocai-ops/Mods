package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import net.minecraft.client.Minecraft;

/**
 * Forge-side twin of the Fabric FullbrightFeature - same technique (write past the options
 * screen's UI-enforced gamma clamp), translated to Mojang's official mappings: `Minecraft` instead
 * of Yarn's `MinecraftClient`, and a direct `options.gamma` field instead of Yarn's `getGamma()`
 * getter - official mappings generally expose these simple option fields directly rather than
 * wrapping them in getters. This field-vs-getter distinction is the main moderate-confidence spot
 * in this file; the `.getValue()`/`.setValue()` calls on the option wrapper itself are never tied
 * to an explicit type name here, so they should hold regardless of what that wrapper class is
 * actually called under official mappings.
 */
public final class FullbrightFeature {
    private double savedGamma = 1.0;
    private boolean applied = false;

    public void tick(ModConfig config) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        if (config.fullbrightEnabled && !applied) {
            savedGamma = client.options.gamma.get();
            client.options.gamma.set(15.0d);
            applied = true;
        } else if (!config.fullbrightEnabled && applied) {
            client.options.gamma.set(savedGamma);
            applied = false;
        }
    }
}
