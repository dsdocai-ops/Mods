package com.omega.client.render;

/**
 * Deterministic block-id -> color so a schematic ghost-preview's different materials are visually
 * distinguishable without real textured block rendering (see SchematicRenderFeature's javadoc for
 * why real block rendering isn't used). Pure string/float math, no Minecraft types, so unlike the
 * rest of SchematicRenderFeature (WorldRenderContext/RenderLayer/VertexConsumer/MatrixStack/Vec3d,
 * all mapping-divergent) this piece can actually be shared.
 */
public final class BlockColorizer {
    private BlockColorizer() {
    }

    /** Null-safe since a corrupted/hand-edited schematic file can carry an entry with a missing "block" field. */
    public static float[] colorForBlock(String blockId) {
        int hash = (blockId != null ? blockId : "unknown").hashCode();
        float hue = ((hash & 0xFFFF) % 360) / 360f;
        return hsvToRgb(hue, 0.55f, 1.0f);
    }

    private static float[] hsvToRgb(float h, float s, float v) {
        int i = (int) (h * 6);
        float f = h * 6 - i;
        float p = v * (1 - s);
        float q = v * (1 - f * s);
        float t = v * (1 - (1 - f) * s);
        return switch (i % 6) {
            case 0 -> new float[]{v, t, p};
            case 1 -> new float[]{q, v, p};
            case 2 -> new float[]{p, v, t};
            case 3 -> new float[]{p, q, v};
            case 4 -> new float[]{t, p, v};
            default -> new float[]{v, p, q};
        };
    }
}
