// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.ModConfig;
import net.minecraft.client.Minecraft;

/**
 * Pure visual brightness override - no mixin needed. Vanilla's options screen clamps the gamma
 * slider to [0, 1], but the underlying gamma value is a plain double with no such clamp once set
 * directly, which is the standard no-mixin way to implement fullbright. This class compiles once
 * here against official mappings and gets remapped per-platform (Loom's
 * transformProductionFabric/transformProductionForge) - both loaders previously carried
 * byte-for-byte-equivalent copies of this exact logic, one against Yarn names, one against these
 * same official names.
 */
public final class FullbrightFeature {
    private double savedGamma = 1.0;
    private boolean applied = false;

    public void tick(ModConfig config) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        boolean fullbrightEnabled = config.fullbrightEnabled;
        if (fullbrightEnabled && !applied) {
            savedGamma = client.options.gamma().get();
            client.options.gamma().set(15.0d);
            applied = true;
        } else if (!fullbrightEnabled && applied) {
            client.options.gamma().set(savedGamma);
            applied = false;
        }
    }
}
