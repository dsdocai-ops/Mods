package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import net.minecraft.client.Minecraft;

/**
 * Forge-side twin of the Fabric FovZoomFeature - same field-vs-getter translation as
 * FullbrightFeature, same re-sync-from-live-value fix (see the Fabric class's javadoc for why
 * capturing the base FOV only once would go stale the moment the player touches vanilla's own FOV
 * slider).
 */
public final class FovZoomFeature {
    private int baseFov = 90;
    private boolean baseFovCaptured = false;
    private int lastAppliedFov = Integer.MIN_VALUE;

    public void tick(ModConfig config, boolean zoomKeyHeld) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        int liveFov = client.options.fov.get();
        if (!baseFovCaptured || liveFov != lastAppliedFov) {
            baseFov = liveFov;
            baseFovCaptured = true;
        }

        int target = zoomKeyHeld ? config.zoomFov : (config.customFovEnabled ? config.customFov : baseFov);

        if (target != lastAppliedFov) {
            client.options.fov.set(target);
            lastAppliedFov = target;
        }
    }
}
