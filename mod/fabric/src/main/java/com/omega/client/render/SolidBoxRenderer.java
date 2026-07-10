// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.render;

import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.util.math.MatrixStack;
import org.joml.Matrix4f;

/**
 * Draws a solid (filled) colored box - the solid-cosmetic counterpart to WireBoxRenderer's outline.
 * Emits into RenderLayer.getDebugFilledBox() (POSITION_COLOR, TRIANGLE_STRIP, culling disabled), the
 * same filled-box layer vanilla's debug renderer uses, so no texture/normal/UV is needed.
 *
 * Each of the six faces is emitted as a strip quad bracketed by duplicated vertices - those doubled
 * verts form zero-area (degenerate) triangles that separate every face and every box in the shared
 * strip buffer, so faces never smear into each other. Culling is disabled on this layer, so winding
 * order doesn't matter for visibility. Callers are expected to be inside a MatrixStack already
 * translated into camera-relative space (same contract as WireBoxRenderer).
 */
public final class SolidBoxRenderer {
    private SolidBoxRenderer() {
    }

    public static void drawBox(MatrixStack matrices, VertexConsumer buffer,
                               double x1, double y1, double z1, double x2, double y2, double z2,
                               float r, float g, float b, float a) {
        Matrix4f mat = matrices.peek().getPositionMatrix();
        float fx1 = (float) x1, fy1 = (float) y1, fz1 = (float) z1;
        float fx2 = (float) x2, fy2 = (float) y2, fz2 = (float) z2;

        // Six faces, each as corners c0..c3. Winding is irrelevant (cull disabled).
        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx2, fy1, fz1, fx2, fy1, fz2, fx1, fy1, fz2); // bottom
        face(mat, buffer, r, g, b, a, fx1, fy2, fz1, fx2, fy2, fz1, fx2, fy2, fz2, fx1, fy2, fz2); // top
        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx2, fy1, fz1, fx2, fy2, fz1, fx1, fy2, fz1); // north
        face(mat, buffer, r, g, b, a, fx1, fy1, fz2, fx2, fy1, fz2, fx2, fy2, fz2, fx1, fy2, fz2); // south
        face(mat, buffer, r, g, b, a, fx1, fy1, fz1, fx1, fy1, fz2, fx1, fy2, fz2, fx1, fy2, fz1); // west
        face(mat, buffer, r, g, b, a, fx2, fy1, fz1, fx2, fy1, fz2, fx2, fy2, fz2, fx2, fy2, fz1); // east
    }

    /** Emits one quad (corners c0,c1,c2,c3) as a triangle strip, degenerate-bracketed so it stays isolated in the shared strip buffer. */
    private static void face(Matrix4f mat, VertexConsumer buffer, float r, float g, float b, float a,
                             float x0, float y0, float z0, float x1, float y1, float z1,
                             float x2, float y2, float z2, float x3, float y3, float z3) {
        // Strip order for a quad c0,c1,c2,c3 is c0,c1,c3,c2. Leading c0 and trailing c2 are doubled
        // to bridge (zero-area) from/to the neighbouring face without drawing a connecting triangle.
        vertex(mat, buffer, r, g, b, a, x0, y0, z0);
        vertex(mat, buffer, r, g, b, a, x0, y0, z0);
        vertex(mat, buffer, r, g, b, a, x1, y1, z1);
        vertex(mat, buffer, r, g, b, a, x3, y3, z3);
        vertex(mat, buffer, r, g, b, a, x2, y2, z2);
        vertex(mat, buffer, r, g, b, a, x2, y2, z2);
    }

    private static void vertex(Matrix4f mat, VertexConsumer buffer, float r, float g, float b, float a, float x, float y, float z) {
        buffer.vertex(mat, x, y, z).color(r, g, b, a).next();
    }
}
