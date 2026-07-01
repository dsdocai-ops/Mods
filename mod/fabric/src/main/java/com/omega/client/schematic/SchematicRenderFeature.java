package com.omega.client.schematic;

import com.omega.client.ModConfig;
import com.omega.client.render.WireBoxRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Ghost-preview renderer for a loaded schematic: a depth-tested, color-coded wireframe box per
 * block, positioned relative to a movable origin. Reuses the same WireBoxRenderer/RenderLayer.getLines
 * approach as BlockHighlightFeature rather than real textured block rendering - that would need
 * MinecraftClient.getBlockRenderManager() calls this project has no way to compile-verify, so this
 * trades "looks like the real block" for "definitely renders, color-coded by block type so different
 * materials are still visually distinguishable".
 *
 * Both the render distance and the per-frame block count are capped for the same reason the block
 * highlight scan was budgeted: a schematic can contain thousands of blocks, and building fresh
 * geometry for all of them every single frame regardless of size would be exactly the kind of
 * unbounded per-frame cost this project has otherwise been careful to avoid.
 */
public final class SchematicRenderFeature {
    private static final double MAX_RENDER_DISTANCE = 64.0;
    private static final double MAX_RENDER_DISTANCE_SQ = MAX_RENDER_DISTANCE * MAX_RENDER_DISTANCE;
    private static final int MAX_RENDERED_BLOCKS_PER_FRAME = 6000;

    private SchematicData active;
    private BlockPos origin = BlockPos.ORIGIN;

    public void setActive(SchematicData data) {
        this.active = data;
    }

    public void clear() {
        this.active = null;
    }

    public SchematicData getActive() {
        return active;
    }

    public void setOrigin(BlockPos origin) {
        this.origin = origin;
    }

    public BlockPos getOrigin() {
        return origin;
    }

    public void render(WorldRenderContext context, ModConfig config) {
        if (!config.schematicPreviewEnabled || active == null || active.blocks.isEmpty()) return;
        VertexConsumerProvider consumers = context.consumers();
        if (consumers == null) return;

        VertexConsumer buffer = consumers.getBuffer(RenderLayer.getLines());
        MatrixStack matrices = context.matrixStack();
        Vec3d camPos = context.camera().getPos();

        matrices.push();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        int rendered = 0;
        for (SchematicBlockEntry entry : active.blocks) {
            if (rendered >= MAX_RENDERED_BLOCKS_PER_FRAME) break;

            double worldX = origin.getX() + entry.x;
            double worldY = origin.getY() + entry.y;
            double worldZ = origin.getZ() + entry.z;
            double dx = worldX + 0.5 - camPos.x;
            double dy = worldY + 0.5 - camPos.y;
            double dz = worldZ + 0.5 - camPos.z;
            if (dx * dx + dy * dy + dz * dz > MAX_RENDER_DISTANCE_SQ) continue;

            float[] rgb = colorForBlock(entry.block);
            WireBoxRenderer.drawBoxOutline(matrices, buffer, new BlockPos((int) worldX, (int) worldY, (int) worldZ), rgb[0], rgb[1], rgb[2], 0.85f);
            rendered++;
        }

        matrices.pop();
    }

    /** Deterministic block-id -> color so different materials are visually distinguishable without real textures. */
    private float[] colorForBlock(String blockId) {
        int hash = blockId.hashCode();
        float hue = ((hash & 0xFFFF) % 360) / 360f;
        return hsvToRgb(hue, 0.55f, 1.0f);
    }

    private float[] hsvToRgb(float h, float s, float v) {
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
