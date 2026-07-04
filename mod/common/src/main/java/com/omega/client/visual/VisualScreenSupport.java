// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.visual;

/**
 * Pure math/String logic backing the in-game Visual Settings screen (Custom FOV / Zoom FOV
 * steppers, Block Highlight color cycling) - zero Minecraft imports, same sharing rule as
 * ParticleScreenSupport. Everything else in that screen (Screen, ButtonWidget/Button,
 * TextFieldWidget/EditBox) is a GUI type that differs between Yarn and official mappings.
 */
public final class VisualScreenSupport {
    private static final int FOV_MIN = 30;
    private static final int FOV_MAX = 110;
    private static final int FOV_STEP = 5;

    private static final int ZOOM_FOV_MIN = 1;
    private static final int ZOOM_FOV_MAX = 70;
    private static final int ZOOM_FOV_STEP = 5;

    /** One step of the highlight color cycle - hex feeds HighlightColorCache, label is what the button shows. */
    private record ColorStep(String hex, String label) {
    }

    // Same alpha (0x80 = ~50%) as the shipped default so cycling never makes the outline harder
    // to see against terrain than the default already is.
    private static final ColorStep[] HIGHLIGHT_COLOR_STEPS = {
            new ColorStep("#803B9CFF", "Blue"), // default
            new ColorStep("#80E63946", "Red"),
            new ColorStep("#80FFD700", "Gold"),
            new ColorStep("#8000FF66", "Green"),
            new ColorStep("#80FFFFFF", "White"),
    };

    private VisualScreenSupport() {
    }

    /** Steps Custom FOV up by FOV_STEP, wrapping back to FOV_MIN once FOV_MAX is passed. */
    public static int nextFov(int current) {
        int next = current + FOV_STEP;
        return next > FOV_MAX ? FOV_MIN : next;
    }

    /** Steps Zoom FOV (hold-C) up by ZOOM_FOV_STEP, wrapping back to ZOOM_FOV_MIN once ZOOM_FOV_MAX is passed. */
    public static int nextZoomFov(int current) {
        int next = current + ZOOM_FOV_STEP;
        return next > ZOOM_FOV_MAX ? ZOOM_FOV_MIN : next;
    }

    /** Cycles through HIGHLIGHT_COLOR_STEPS, wrapping back to the first step once the last is passed. */
    public static String nextHighlightColor(String currentArgb) {
        int index = indexOfColorStep(currentArgb);
        return index < 0 ? HIGHLIGHT_COLOR_STEPS[0].hex() : HIGHLIGHT_COLOR_STEPS[(index + 1) % HIGHLIGHT_COLOR_STEPS.length].hex();
    }

    /** Human-readable label for the current highlight color step (falls back to the raw hex for a custom/unrecognized value). */
    public static String highlightColorLabel(String currentArgb) {
        int index = indexOfColorStep(currentArgb);
        return index < 0 ? currentArgb : HIGHLIGHT_COLOR_STEPS[index].label();
    }

    private static int indexOfColorStep(String argb) {
        for (int i = 0; i < HIGHLIGHT_COLOR_STEPS.length; i++) {
            if (HIGHLIGHT_COLOR_STEPS[i].hex().equalsIgnoreCase(argb)) return i;
        }
        return -1;
    }
}
