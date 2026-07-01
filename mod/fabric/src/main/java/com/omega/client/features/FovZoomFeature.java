package com.omega.client.features;

import com.omega.client.ModConfig;
import net.minecraft.client.MinecraftClient;

/**
 * Custom base FOV and a hold-to-zoom key, both implemented by writing directly to
 * {@code GameOptions.getFov()} - same no-mixin technique as fullbright, no automation involved.
 */
public final class FovZoomFeature {
    private int baseFov = 90;
    private boolean baseFovCaptured = false;
    private int lastAppliedFov = Integer.MIN_VALUE;

    public void tick(ModConfig config, boolean zoomKeyHeld) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.options == null) return;

        if (!baseFovCaptured) {
            baseFov = client.options.getFov().getValue();
            baseFovCaptured = true;
        }

        int target = zoomKeyHeld ? config.zoomFov : (config.customFovEnabled ? config.customFov : baseFov);

        // GameOptions.setValue() isn't a no-op write - avoid calling it every tick when nothing changed.
        if (target != lastAppliedFov) {
            client.options.getFov().setValue(target);
            lastAppliedFov = target;
        }
    }
}
