// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Pure vertex data for the gear cosmetics (hat/cape/wings) - zero Minecraft imports, computed once
 * at class load, shared by both loaders' renderers (CosmeticFeatureRenderer / CosmeticRenderLayer)
 * and by the generate-cosmetic skill's preview dumper, so the in-game shapes and the skill's
 * preview screenshots can never drift apart.
 *
 * Coordinate contract (matches vanilla player-model part space, which is what the renderers are in
 * after ModelPart.rotate/translateAndRotate on the anchor part):
 *   - units: 1.0 = one block; shapes below are authored in model pixels and divided by 16
 *   - y is DOWN-positive (the entity renderer's scale(-1,-1,1) flip turns it right side up)
 *   - +z is the player's BACK (vanilla hangs its own cape at +z)
 *   - HAT is anchored to the head part (head box spans x/z ±4px, y -8..0, hat overlay ±4.5px);
 *     CAPE and WINGS are anchored to the body part (torso x ±4, y 0..12, z ±2, jacket overlay +0.25)
 *
 * Every face is emitted DOUBLE-SIDED (both windings): the entity flip above inverts winding order,
 * and whether the debug-quads layer culls back faces isn't something this project can check outside
 * CI - a handful of duplicate quads per player is cheaper than a wrong guess that culls the whole
 * cosmetic invisible. Lighting is baked into each quad's shade (position-color rendering has no
 * normals/light), using vanilla's flat directional feel: up-facing 1.0, sides 0.65, down-facing 0.5.
 */
public final class CosmeticGeometry {
    /**
     * One quad: 4 vertices * xyz, in model units, wound ready to emit in order. secondary picks
     * Cosmetic.secondaryRgb over primaryRgb; shade is the baked lighting multiplier for all three
     * color channels.
     */
    public record Quad(float[] positions, boolean secondary, float shade) {
    }

    private static final float PX = 1f / 16f;

    private static final Map<CosmeticCatalog.Kind, List<Quad>> SHAPES = buildShapes();

    private CosmeticGeometry() {
    }

    /** Empty for BADGE (badges recolor the nametag via EntityRendererMixin - no geometry). */
    public static List<Quad> quadsFor(CosmeticCatalog.Kind kind) {
        return SHAPES.getOrDefault(kind, List.of());
    }

    private static Map<CosmeticCatalog.Kind, List<Quad>> buildShapes() {
        Map<CosmeticCatalog.Kind, List<Quad>> shapes = new EnumMap<>(CosmeticCatalog.Kind.class);
        shapes.put(CosmeticCatalog.Kind.HAT, List.copyOf(hat()));
        shapes.put(CosmeticCatalog.Kind.CAPE, List.copyOf(cape()));
        shapes.put(CosmeticCatalog.Kind.WINGS, List.copyOf(wings()));
        return shapes;
    }

    /**
     * Top hat: wide brim + crown (primary) with a band (secondary). Sits above the hat-overlay
     * layer (y -8.5) to avoid z-fighting it; the crown and band bottoms sink INTO the brim's volume
     * (rather than abutting its top face) so no two faces are ever coplanar - coincident planes
     * from different boxes would flicker in-game, since every face here renders double-sided.
     */
    private static List<Quad> hat() {
        List<Quad> out = new ArrayList<>();
        box(out, false, -6f, -9.6f, -6f, 6f, -8.6f, 6f);            // brim
        box(out, false, -4.25f, -17.6f, -4.25f, 4.25f, -9.1f, 4.25f); // crown
        box(out, true, -4.75f, -12.6f, -4.75f, 4.75f, -9.5f, 4.75f);  // band, 0.5px proud of the crown
        return out;
    }

    /** One sheared slab hanging from the shoulders, tilted ~15° back; the body-facing surface is the secondary-color lining. */
    private static List<Quad> cape() {
        List<Quad> out = new ArrayList<>();
        panel(out, false, true, 0.6f,
                -4.5f, 0.5f, 2.6f,
                4.5f, 0.5f, 2.6f,
                4.5f, 15.9f, 6.7f,
                -4.5f, 15.9f, 6.7f);
        return out;
    }

    /** Two swept-back panels (primary) each with a thin ridge along the top edge (secondary). Mirrored across x=0. */
    private static List<Quad> wings() {
        List<Quad> out = new ArrayList<>();
        for (int side = -1; side <= 1; side += 2) {
            float s = side;
            panel(out, false, false, 0.6f,
                    0.5f * s, 1.5f, 3.0f,
                    12f * s, -4.5f, 7.5f,
                    10f * s, 10.5f, 8.5f,
                    0.5f * s, 11f, 3.6f);
            panel(out, true, false, 1.0f,
                    0.5f * s, 1.5f, 2.8f,
                    12f * s, -4.5f, 7.3f,
                    12.4f * s, -3.3f, 7.3f,
                    0.9f * s, 2.7f, 2.8f);
        }
        return out;
    }

    /**
     * Axis-aligned box in model pixels. Package-private (not part of the mod's runtime API beyond
     * this class) so the generate-cosmetic skill's GeometryDump - compiled into this package by
     * javac - can reuse the exact same face/shade math for its stand-in player figure.
     */
    static void box(List<Quad> out, boolean secondary, float x1, float y1, float z1, float x2, float y2, float z2) {
        panel(out, secondary, secondary, z2 - z1,
                x1, y1, z1,
                x2, y1, z1,
                x2, y2, z1,
                x1, y2, z1);
    }

    /**
     * A quad face extruded along +z by thicknessZ into a 6-faced slab (the front face may be
     * non-axis-aligned - that's how the cape's tilt and the wings' sweep are baked in, so the
     * loader renderers never need a rotation call). corners = the front face's 4 vertices (xyz * 4)
     * in model pixels. frontFaceSecondary lets the cape color its body-facing lining separately.
     */
    static void panel(List<Quad> out, boolean secondary, boolean frontFaceSecondary, float thicknessZ, float... corners) {
        float[][] p = new float[4][3];
        float[][] q = new float[4][3];
        for (int i = 0; i < 4; i++) {
            p[i][0] = corners[i * 3];
            p[i][1] = corners[i * 3 + 1];
            p[i][2] = corners[i * 3 + 2];
            q[i][0] = p[i][0];
            q[i][1] = p[i][1];
            q[i][2] = p[i][2] + thicknessZ;
        }
        face(out, frontFaceSecondary, p[0], p[1], p[2], p[3]);
        face(out, secondary, q[3], q[2], q[1], q[0]);
        for (int i = 0; i < 4; i++) {
            int next = (i + 1) % 4;
            face(out, secondary, p[i], q[i], q[next], p[next]);
        }
    }

    /** Emits one face as two quads (both windings - see class doc) with its baked directional shade. */
    private static void face(List<Quad> out, boolean secondary, float[] a, float[] b, float[] c, float[] d) {
        float shade = shadeOf(a, b, c, d);
        out.add(new Quad(scaled(a, b, c, d), secondary, shade));
        out.add(new Quad(scaled(d, c, b, a), secondary, shade));
    }

    private static float[] scaled(float[] a, float[] b, float[] c, float[] d) {
        float[][] v = { a, b, c, d };
        float[] positions = new float[12];
        for (int i = 0; i < 4; i++) {
            positions[i * 3] = v[i][0] * PX;
            positions[i * 3 + 1] = v[i][1] * PX;
            positions[i * 3 + 2] = v[i][2] * PX;
        }
        return positions;
    }

    /** Vanilla-flavored flat shade from the face normal: up-facing 1.0, vertical sides 0.65, down-facing 0.5 (y-down space, so "up" is -y). */
    private static float shadeOf(float[] a, float[] b, float[] c, float[] d) {
        float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        float vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        float nx = uy * vz - uz * vy;
        float ny = uz * vx - ux * vz;
        float nz = ux * vy - uy * vx;
        float len = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-6f) return 0.65f;
        float upness = -ny / len;
        return 0.65f + 0.35f * Math.max(0f, upness) - 0.15f * Math.max(0f, -upness);
    }
}
