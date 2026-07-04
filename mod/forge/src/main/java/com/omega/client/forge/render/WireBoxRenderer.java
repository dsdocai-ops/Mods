// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.render;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.core.BlockPos;

/**
 * Forge-side twin of the Fabric WireBoxRenderer. Renames vs. Yarn: MatrixStack -> PoseStack,
 * matrices.peek() -> matrices.last(), .getPositionMatrix()/.getNormalMatrix() -> .pose()/.normal()
 * on the stack entry, and VertexConsumer.next() -> .endVertex(). These matrix/vertex-builder
 * renames are well-established, commonly-cited official-mappings names (higher confidence than
 * most of the rest of this module).
 */
public final class WireBoxRenderer {
    private WireBoxRenderer() {
    }

    public static void drawBoxOutline(PoseStack matrices, VertexConsumer buffer, BlockPos pos, float r, float g, float b, float a) {
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

        var matrix = matrices.last().pose();
        var normalMatrix = matrices.last().normal();

        for (double[] e : edges) {
            float nx = (float) (e[3] - e[0]);
            float ny = (float) (e[4] - e[1]);
            float nz = (float) (e[5] - e[2]);
            buffer.vertex(matrix, (float) e[0], (float) e[1], (float) e[2]).color(r, g, b, a).normal(normalMatrix, nx, ny, nz).endVertex();
            buffer.vertex(matrix, (float) e[3], (float) e[4], (float) e[5]).color(r, g, b, a).normal(normalMatrix, nx, ny, nz).endVertex();
        }
    }
}
