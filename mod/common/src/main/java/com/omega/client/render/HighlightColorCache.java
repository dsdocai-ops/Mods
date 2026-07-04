package com.omega.client.render;

/**
 * Parses "#AARRGGBB"/"#RRGGBB" into normalized [r,g,b,a], caching the last parse so a per-frame
 * caller re-supplying an unchanged config string doesn't pay the parse cost every frame. The only
 * piece of BlockHighlightFeature that doesn't touch a mapping-divergent type (World/Level,
 * BlockPos, Identifier/ResourceLocation, RenderLayer/RenderType, VertexConsumer/MultiBufferSource,
 * MatrixStack/PoseStack, Vec3d/Vec3, Registries/BuiltInRegistries all differ between Yarn and
 * official mappings) - everything else in that class stays loader-specific by necessity, this is
 * the one part that can actually be shared.
 */
public final class HighlightColorCache {
    private static final float[] DEFAULT_COLOR = {0.6f, 0.2f, 1.0f, 0.75f};

    private String lastSource = null;
    private float[] lastColor = defaultColor();

    public float[] resolve(String argb) {
        if (argb.equals(lastSource)) return lastColor;
        lastSource = argb;
        lastColor = parse(argb);
        return lastColor;
    }

    private float[] parse(String argb) {
        try {
            String hex = argb.startsWith("#") ? argb.substring(1) : argb;
            if (hex.length() == 6) hex = "FF" + hex;
            long value = Long.parseLong(hex, 16);
            float a = ((value >> 24) & 0xFF) / 255f;
            float r = ((value >> 16) & 0xFF) / 255f;
            float g = ((value >> 8) & 0xFF) / 255f;
            float b = (value & 0xFF) / 255f;
            return new float[]{r, g, b, a};
        } catch (Exception e) {
            return defaultColor();
        }
    }

    // A fresh copy each time, not the shared DEFAULT_COLOR reference - the only current caller
    // never mutates the returned array, but handing out the same backing array on every failed
    // parse would let one caller's in-place edit corrupt the fallback for every other caller.
    private static float[] defaultColor() {
        return DEFAULT_COLOR.clone();
    }
}
