package com.omega.client.render;

import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.BlockPos;

/**
 * Draws a depth-tested wireframe cube outline around a block position. Shared by BlockHighlightFeature
 * and the schematic ghost preview - both want the same "outline, occluded by terrain" behavior (see
 * BlockHighlightFeature's class doc for why depth-tested rendering matters here).
 *
 * Callers are expected to have already selected RenderLayer.getLines() on the VertexConsumer and be
 * inside a MatrixStack translated into camera-relative space.
 */
public final class WireBoxRenderer {
    private WireBoxRenderer() {
    }

    public static void drawBoxOutline(MatrixStack matrices, VertexConsumer buffer, BlockPos pos, float r, float g, float b, float a) {
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
            buffer.vertex(matrix, (float) e[0], (float) e[1], (float) e[2]).color(r, g, b, a).normal(normalMatrix, nx, ny, nz).next();
            buffer.vertex(matrix, (float) e[3], (float) e[4], (float) e[5]).color(r, g, b, a).normal(normalMatrix, nx, ny, nz).next();
        }
    }
}
