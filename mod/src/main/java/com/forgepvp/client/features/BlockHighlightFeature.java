package com.forgepvp.client.features;

import com.forgepvp.client.ModConfig;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Draws a depth-tested wireframe outline around configured block types near the player.
 *
 * Deliberately depth-tested (RenderLayer.getLines(), the same layer vanilla's own F3+B hitbox
 * debug rendering uses): terrain still occludes it, so this only ever emphasizes blocks the
 * player could already see, matching "combat clarity" rather than an x-ray/wallhack.
 */
public final class BlockHighlightFeature {
    private static final int SCAN_RADIUS = 20;
    private static final int RESCAN_INTERVAL_TICKS = 10;
    private static final int MAX_HIGHLIGHTS = 400;

    private final List<BlockPos> cachedMatches = new ArrayList<>();
    private int ticksSinceRescan = RESCAN_INTERVAL_TICKS;

    public void tick(ModConfig config, World world, BlockPos center) {
        if (!config.blockHighlightEnabled || world == null || center == null) {
            cachedMatches.clear();
            return;
        }

        ticksSinceRescan++;
        if (ticksSinceRescan < RESCAN_INTERVAL_TICKS) return;
        ticksSinceRescan = 0;

        Set<Identifier> targets = new HashSet<>();
        for (String id : config.highlightedBlocks) {
            Identifier parsed = Identifier.tryParse(id);
            if (parsed != null) targets.add(parsed);
        }

        cachedMatches.clear();
        BlockPos min = center.add(-SCAN_RADIUS, -SCAN_RADIUS, -SCAN_RADIUS);
        BlockPos max = center.add(SCAN_RADIUS, SCAN_RADIUS, SCAN_RADIUS);

        for (BlockPos pos : BlockPos.iterate(min, max)) {
            if (cachedMatches.size() >= MAX_HIGHLIGHTS) break;
            Identifier blockId = Registries.BLOCK.getId(world.getBlockState(pos).getBlock());
            if (targets.contains(blockId)) {
                cachedMatches.add(pos.toImmutable());
            }
        }
    }

    public void render(WorldRenderContext context, ModConfig config) {
        if (!config.blockHighlightEnabled || cachedMatches.isEmpty()) return;
        VertexConsumerProvider consumers = context.consumers();
        if (consumers == null) return;

        float[] rgba = parseColor(config.highlightColorArgb);
        VertexConsumer buffer = consumers.getBuffer(RenderLayer.getLines());
        MatrixStack matrices = context.matrixStack();
        Vec3d camPos = context.camera().getPos();

        matrices.push();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (BlockPos pos : cachedMatches) {
            drawBoxOutline(matrices, buffer, pos, rgba);
        }

        matrices.pop();
    }

    private void drawBoxOutline(MatrixStack matrices, VertexConsumer buffer, BlockPos pos, float[] rgba) {
        double x1 = pos.getX() - 0.002;
        double y1 = pos.getY() - 0.002;
        double z1 = pos.getZ() - 0.002;
        double x2 = pos.getX() + 1.002;
        double y2 = pos.getY() + 1.002;
        double z2 = pos.getZ() + 1.002;

        double[][] edges = {
                {x1, y1, z1, x2, y1, z1}, {x2, y1, z1, x2, y1, z2}, {x2, y1, z2, x1, y1, z2}, {x1, y1, z2, x1, y1, z1},
                {x1, y2, z1, x2, y2, z1}, {x2, y2, z1, x2, y2, z2}, {x2, y2, z2, x1, y2, z2}, {x1, y2, z2, x1, y2, z1},
                {x1, y1, z1, x1, y2, z1}, {x2, y1, z1, x2, y2, z1}, {x2, y1, z2, x2, y2, z2}, {x1, y1, z2, x1, y2, z2},
        };

        var matrix = matrices.peek().getPositionMatrix();
        var normalMatrix = matrices.peek().getNormalMatrix();

        for (double[] e : edges) {
            float nx = (float) (e[3] - e[0]);
            float ny = (float) (e[4] - e[1]);
            float nz = (float) (e[5] - e[2]);
            buffer.vertex(matrix, (float) e[0], (float) e[1], (float) e[2])
                    .color(rgba[0], rgba[1], rgba[2], rgba[3])
                    .normal(normalMatrix, nx, ny, nz)
                    .next();
            buffer.vertex(matrix, (float) e[3], (float) e[4], (float) e[5])
                    .color(rgba[0], rgba[1], rgba[2], rgba[3])
                    .normal(normalMatrix, nx, ny, nz)
                    .next();
        }
    }

    /** Parses "#AARRGGBB" or "#RRGGBB" into normalized [r,g,b,a]. Falls back to a visible default on any parse issue. */
    private float[] parseColor(String argb) {
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
            return new float[]{0.6f, 0.2f, 1.0f, 0.75f};
        }
    }
}
