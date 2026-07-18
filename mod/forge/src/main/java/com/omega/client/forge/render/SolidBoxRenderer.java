// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.render;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import org.joml.Matrix4f;

/**
 * Forge-side twin of the Fabric SolidBoxRenderer: a solid (filled) colored box into
 * RenderType.debugFilledBox() (POSITION_COLOR, TRIANGLE_STRIP, culling disabled). Same
 * degenerate-bracketed per-face strip emission and same matrix contract; official-mappings renames
 * only (matrices.last().pose(), buffer...endVertex()).
 */
public final class SolidBoxRenderer {
    private SolidBoxRenderer() {
    }

    public static void drawBox(PoseStack matrices, VertexConsumer buffer,
                               double x1, double y1, double z1, double x2, double y2, double z2,
                               float r, float g, float b, float a) {
        Matrix4f mat = matrices.last().pose();
        float fx1 = (float) x1, fy1 = (float) y1, fz1 = (float) z1;
        float fx2 = (float) x2, fy2 = (float) y2, fz2 = (float) z2;

        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx2, fy1, fz1, fx2, fy1, fz2, fx1, fy1, fz2); // bottom
        face(mat, buffer, r, g, b, a, fx1, fy2, fz1, fx2, fy2, fz1, fx2, fy2, fz2, fx1, fy2, fz2); // top
        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx2, fy1, fz1, fx2, fy2, fz1, fx1, fy2, fz1); // north
        face(mat, buffer, r, g, b, a, fx1, fy1, fz2, fx2, fy1, fz2, fx2, fy2, fz2, fx1, fy2, fz2); // south
        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx1, fy1, fz2, fx1, fy2, fz2, fx1, fy2, fz1); // west
        face(mat, buffer, r, g, b, a, fx2, fy1, fz1, fx2, fy1, fz2, fx2, fy2, fz2, fx2, fy2, fz1); // east
    }

    private static void face(Matrix4f mat, VertexConsumer buffer, float r, float g, float b, float a,
                             float x0, float y0, float z0, float x1, float y1, float z1,
                             float x2, float y2, float z2, float x3, float y3, float z3) {
        vertex(mat, buffer, r, g, b, a, x0, y0, z0);
        vertex(mat, buffer, r, g, b, a, x0, y0, z0);
        vertex(mat, buffer, r, g, b, a, x1, y1, z1);
        vertex(mat, buffer, r, g, b, a, x3, y3, z3);
        vertex(mat, buffer, r, g, b, a, x2, y2, z2);
        vertex(mat, buffer, r, g, b, a, x2, y2, z2);
    }

    private static void vertex(Matrix4f mat, VertexConsumer buffer, float r, float g, float b, float a, float x, float y, float z) {
        buffer.vertex(mat, x, y, z).color(r, g, b, a).endVertex();
    }
}
