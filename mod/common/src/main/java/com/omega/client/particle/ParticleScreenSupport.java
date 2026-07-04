package com.omega.client.particle;

/**
 * The two pieces of ParticleScreen's logic that are pure String/float math with zero Minecraft
 * types - everything else in that class (Screen, ButtonWidget/Button, TextFieldWidget/EditBox,
 * DrawContext/GuiGraphics, Text/Component) is a GUI type that differs between Yarn and official
 * mappings, so only this sliver can be shared. Duplicated identically between the Fabric and Forge
 * ParticleScreen twins before this extraction.
 */
public final class ParticleScreenSupport {
    private static final float[] DENSITY_STEPS = {1.0f, 0.75f, 0.5f, 0.25f, 0.1f};

    private ParticleScreenSupport() {
    }

    /** Cycles through DENSITY_STEPS, wrapping back to the first step once the last is passed. */
    public static float nextDensityStep(float current) {
        for (int i = 0; i < DENSITY_STEPS.length; i++) {
            if (Math.abs(DENSITY_STEPS[i] - current) < 0.001f) {
                return DENSITY_STEPS[(i + 1) % DENSITY_STEPS.length];
            }
        }
        return DENSITY_STEPS[0];
    }

    /** Defaults a bare id (no namespace) to "minecraft:" - the same shorthand vanilla commands accept. */
    public static String normalizeBlacklistId(String raw) {
        return raw.contains(":") ? raw : "minecraft:" + raw;
    }
}
