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

        // If the live value doesn't match the last one *we* wrote, something else changed it - most
        // likely the player adjusting the FOV slider in vanilla's own Options screen. Re-capture it
        // as the new base so zoom (and turning Custom FOV off) returns to what the player actually
        // has it set to now, not whatever it was when this mod first ticked. Without this, a base
        // captured once at load time would never notice a later vanilla-side change, and holding
        // then releasing zoom would silently snap FOV back to that stale value.
        int liveFov = client.options.getFov().getValue();
        if (!baseFovCaptured || liveFov != lastAppliedFov) {
            baseFov = liveFov;
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
