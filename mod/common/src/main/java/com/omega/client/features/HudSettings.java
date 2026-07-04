// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.ModConfig;

/**
 * Immutable snapshot of the HUD-relevant ModConfig flags - InfoHudFeature takes this instead of
 * the loader-specific ModConfig type directly, same decoupling reason as FullbrightFeature/
 * FovZoomFeature/ToggleSprintFeature, just as a record instead of raw parameters since there are
 * seven flags here rather than one to three.
 */
public record HudSettings(
        boolean enabled,
        boolean showCoords,
        boolean showFps,
        boolean showPing,
        boolean showDirection,
        boolean showCps,
        boolean showKeystrokes
) {
    public static HudSettings from(ModConfig config) {
        return new HudSettings(
                config.hudEnabled,
                config.hudShowCoords,
                config.hudShowFps,
                config.hudShowPing,
                config.hudShowDirection,
                config.hudShowCps,
                config.hudShowKeystrokes
        );
    }
}
