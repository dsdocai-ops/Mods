package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import net.minecraft.client.Minecraft;

/** Forge-side twin of the Fabric FovZoomFeature - same field-vs-getter translation as FullbrightFeature. */
public final class FovZoomFeature {
    private int baseFov = 90;
    private boolean baseFovCaptured = false;
    private int lastAppliedFov = Integer.MIN_VALUE;

    public void tick(ModConfig config, boolean zoomKeyHeld) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        if (!baseFovCaptured) {
            baseFov = client.options.fov.get();
            baseFovCaptured = true;
        }

        int target = zoomKeyHeld ? config.zoomFov : (config.customFovEnabled ? config.customFov : baseFov);

        if (target != lastAppliedFov) {
            client.options.fov.set(target);
            lastAppliedFov = target;
        }
    }
}
