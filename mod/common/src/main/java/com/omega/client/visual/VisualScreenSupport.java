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

    // Same alpha (0x80 = ~50%) as the shipped default so cycling never makes the outline harder
    // to see against terrain than the default already is.
    private static final String[] HIGHLIGHT_COLOR_STEPS = {
            "#803B9CFF", // blue (default)
            "#80E63946", // red
            "#80FFD700", // gold
            "#8000FF66", // green
            "#80FFFFFF", // white
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
        for (int i = 0; i < HIGHLIGHT_COLOR_STEPS.length; i++) {
            if (HIGHLIGHT_COLOR_STEPS[i].equalsIgnoreCase(currentArgb)) {
                return HIGHLIGHT_COLOR_STEPS[(i + 1) % HIGHLIGHT_COLOR_STEPS.length];
            }
        }
        return HIGHLIGHT_COLOR_STEPS[0];
    }

    /** Human-readable label for the current highlight color step (falls back to the raw hex for a custom/unrecognized value). */
    public static String highlightColorLabel(String currentArgb) {
        for (String step : HIGHLIGHT_COLOR_STEPS) {
            if (step.equalsIgnoreCase(currentArgb)) {
                return switch (step) {
                    case "#803B9CFF" -> "Blue";
                    case "#80E63946" -> "Red";
                    case "#80FFD700" -> "Gold";
                    case "#8000FF66" -> "Green";
                    case "#80FFFFFF" -> "White";
                    default -> step;
                };
            }
        }
        return currentArgb;
    }
}
