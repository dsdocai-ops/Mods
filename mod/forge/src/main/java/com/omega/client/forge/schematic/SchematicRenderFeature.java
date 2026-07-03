package com.omega.client.forge.schematic;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.omega.client.forge.ModConfig;
import com.omega.client.forge.render.WireBoxRenderer;
import com.omega.client.schematic.SchematicBlockEntry;
import com.omega.client.schematic.SchematicData;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.Vec3;

/**
 * Forge-side twin of the Fabric SchematicRenderFeature - same color-coded wireframe approach (see
 * that class's doc for why). Renders from plain vanilla parameters (PoseStack, MultiBufferSource,
 * camera Vec3) rather than a Fabric-style event-context wrapper, so this class itself doesn't
 * depend on how the caller obtained them - the Forge entrypoint's RenderLevelStageEvent handler
 * extracts these from its own event type and calls in.
 *
 * Renames vs. Yarn: Vec3d -> Vec3, RenderLayer -> RenderType, VertexConsumerProvider ->
 * MultiBufferSource (all well-established, high confidence).
 *
 * The per-frame examined-block cap (not just the drawn-block cap) matches a fix applied to the
 * Fabric twin of this class - see its javadoc: capping only the draw count left the block-list walk
 * itself unbounded whenever most blocks were out of render range.
 *
 * The examine budget also rotates its starting point across frames (examineStartIndex) rather than
 * always restarting at index 0 - another fix mirrored from the Fabric twin, see its javadoc: without
 * this, any schematic bigger than the examine cap would permanently strand every entry past it.
 */
public final class SchematicRenderFeature {
    private static final double MAX_RENDER_DISTANCE = 64.0;
    private static final double MAX_RENDER_DISTANCE_SQ = MAX_RENDER_DISTANCE * MAX_RENDER_DISTANCE;
    private static final int MAX_RENDERED_BLOCKS_PER_FRAME = 6000;
    private static final int MAX_EXAMINED_BLOCKS_PER_FRAME = 20000;

    private SchematicData active;
    private BlockPos origin = BlockPos.ZERO;
    private int examineStartIndex = 0;

    public void setActive(SchematicData data) {
        this.active = data;
        this.examineStartIndex = 0;
    }

    public void clear() {
        this.active = null;
        this.examineStartIndex = 0;
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

    public void render(PoseStack matrices, MultiBufferSource consumers, Vec3 camPos, ModConfig config) {
        if (!config.schematicPreviewEnabled || active == null || active.blocks.isEmpty()) return;

        VertexConsumer buffer = consumers.getBuffer(RenderType.lines());

        matrices.pushPose();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        int size = active.blocks.size();
        if (examineStartIndex >= size) examineStartIndex = 0;

        int rendered = 0;
        int examined = 0;
        int index = examineStartIndex;
        while (examined < size && rendered < MAX_RENDERED_BLOCKS_PER_FRAME && examined < MAX_EXAMINED_BLOCKS_PER_FRAME) {
            SchematicBlockEntry entry = active.blocks.get(index);
            index = (index + 1) % size;
            examined++;

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
        examineStartIndex = index;

        matrices.popPose();
    }

    /** Deterministic block-id -> color so different materials are visually distinguishable without real textures - null-safe since a corrupted/hand-edited schematic file can carry an entry with a missing "block" field. */
    private float[] colorForBlock(String blockId) {
        int hash = (blockId != null ? blockId : "unknown").hashCode();
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
