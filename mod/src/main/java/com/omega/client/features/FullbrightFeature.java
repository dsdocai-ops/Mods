package com.omega.client.features;

import com.omega.client.ModConfig;
import net.minecraft.client.MinecraftClient;

/**
 * Pure visual brightness override - no mixin needed. Vanilla's options screen clamps the gamma
 * slider to [0, 1], but the underlying {@code GameOptions.gamma} value is a plain double with no
 * such clamp once set directly, which is the standard no-mixin way Fabric mods implement fullbright.
 */
public final class FullbrightFeature {
    private double savedGamma = 1.0;
    private boolean applied = false;

    public void tick(ModConfig config) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.options == null) return;

        if (config.fullbrightEnabled && !applied) {
            savedGamma = client.options.getGamma().getValue();
            client.options.getGamma().setValue(15.0d);
            applied = true;
        } else if (!config.fullbrightEnabled && applied) {
            client.options.getGamma().setValue(savedGamma);
            applied = false;
        }
    }
}
