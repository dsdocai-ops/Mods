package com.forgepvp.client.features;

import com.forgepvp.client.ModConfig;
import net.minecraft.client.MinecraftClient;

/**
 * Custom base FOV and a hold-to-zoom key, both implemented by writing directly to
 * {@code GameOptions.getFov()} - same no-mixin technique as fullbright, no automation involved.
 */
public final class FovZoomFeature {
    private int baseFov = 90;
    private boolean baseFovCaptured = false;

    public void tick(ModConfig config, boolean zoomKeyHeld) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.options == null) return;

        if (!baseFovCaptured) {
            baseFov = client.options.getFov().getValue();
            baseFovCaptured = true;
        }

        if (zoomKeyHeld) {
            client.options.getFov().setValue(config.zoomFov);
            return;
        }

        int target = config.customFovEnabled ? config.customFov : baseFov;
        client.options.getFov().setValue(target);
    }
}
