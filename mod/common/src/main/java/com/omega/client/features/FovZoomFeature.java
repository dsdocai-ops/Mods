package com.omega.client.features;

import com.omega.client.ModConfig;
import net.minecraft.client.Minecraft;

/**
 * Custom base FOV and a hold-to-zoom key, both implemented by writing directly to the FOV option -
 * same no-mixin technique as fullbright, no automation involved. Compiles once here against official
 * mappings, remapped per-platform (see FullbrightFeature's javadoc for the general pattern).
 *
 * zoomKeyHeld is passed separately rather than folded into ModConfig - it's the zoom keybinding's
 * live pressed-state, not a persisted config flag, so each loader still reads its own
 * KeyBinding/KeyMapping.isPressed()/isDown() and hands the result in.
 */
public final class FovZoomFeature {
    private int baseFov = 90;
    private boolean baseFovCaptured = false;
    private int lastAppliedFov = Integer.MIN_VALUE;

    public void tick(ModConfig config, boolean zoomKeyHeld) {
        Minecraft client = Minecraft.getInstance();
        if (client.options == null) return;

        int zoomFov = config.zoomFov;
        boolean customFovEnabled = config.customFovEnabled;
        int customFov = config.customFov;

        // If the live value doesn't match the last one *we* wrote, something else changed it - most
        // likely the player adjusting the FOV slider in vanilla's own Options screen. Re-capture it
        // as the new base so zoom (and turning Custom FOV off) returns to what the player actually
        // has it set to now, not whatever it was when this mod first ticked. Without this, a base
        // captured once at load time would never notice a later vanilla-side change, and holding
        // then releasing zoom would silently snap FOV back to that stale value.
        int liveFov = client.options.fov().get();
        if (!baseFovCaptured || liveFov != lastAppliedFov) {
            baseFov = liveFov;
            baseFovCaptured = true;
        }

        int target = zoomKeyHeld ? zoomFov : (customFovEnabled ? customFov : baseFov);

        // OptionInstance.set() isn't a no-op write - avoid calling it every tick when nothing changed.
        if (target != lastAppliedFov) {
            client.options.fov().set(target);
            lastAppliedFov = target;
        }
    }
}
