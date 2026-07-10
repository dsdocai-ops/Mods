// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Turns a cosmetic's pixel art (CosmeticPixelArt) into 3D quads the same way vanilla turns a flat
 * item texture into the extruded model you see held or dropped: every opaque pixel becomes a
 * colored cell one extrusion deep, transparent pixels cut the silhouette, and edge faces are
 * emitted only where a pixel borders transparency - so no two faces are ever coplanar (which would
 * z-fight, since every face renders double-sided) and interior faces don't exist at all.
 * Zero Minecraft imports, computed once per cosmetic id, shared by both loaders' renderers
 * (CosmeticFeatureRenderer / CosmeticRenderLayer) and by the generate-cosmetic skill's preview
 * dumper, so the in-game shapes and the skill's preview screenshots can never drift apart.
 *
 * Coordinate contract (matches vanilla player-model part space, which is what the renderers are in
 * after ModelPart.rotate/translateAndRotate on the anchor part):
 *   - units: 1.0 = one block; frames below are authored in model pixels and divided by 16
 *   - y is DOWN-positive (the entity renderer's scale(-1,-1,1) flip turns it right side up)
 *   - +z is the player's BACK (vanilla hangs its own cape at +z)
 *
 * Each kind defines a FRAME the art is stretched into - an origin (art's top-left), a u axis (one
 * pixel step rightward in the art), a v axis (one pixel step downward), and an extrusion depth:
 *   - HAT: a front-facing vertical plane whose bottom rests just above the hat-overlay layer
 *     (overlay top is y -8.5), extruded through the full head depth (z -4.5..+4.5), anchored to
 *     the head part - so the art is the hat's front/back silhouette
 *   - CAPE: a plane hung from the shoulders, tilted ~15° back, 0.6px thin, anchored to the body
 *   - WINGS: a swept-back parallelogram per wing (art = right wing, x-mirrored for the left),
 *     0.6px thin, anchored to the body
 *
 * Lighting is baked into each quad's shade (position-color rendering has no normals/light), using
 * vanilla's flat directional feel: up-facing 1.0, sides 0.65, down-facing 0.5. Faces are emitted
 * double-sided (both windings): the entity flip above inverts winding order, and whether the
 * debug-quads layer culls back faces isn't checkable outside CI - duplicate quads are cheaper than
 * a wrong guess that culls a cosmetic invisible.
 */
public final class CosmeticGeometry {
    /** One quad: 4 vertices * xyz in model units, its palette color, and the baked lighting multiplier. */
    public record Quad(float[] positions, int rgb, float shade) {
    }

    private static final float PX = 1f / 16f;

    private static final Map<String, List<Quad>> CACHE = new ConcurrentHashMap<>();

    private CosmeticGeometry() {
    }

    /** Empty for BADGE (badges recolor the nametag via EntityRendererMixin - no geometry) and for null. */
    public static List<Quad> quadsFor(CosmeticCatalog.Cosmetic cosmetic) {
        if (cosmetic == null || cosmetic.art() == null) return List.of();
        return CACHE.computeIfAbsent(cosmetic.id(), id -> List.copyOf(build(cosmetic)));
    }

    private static List<Quad> build(CosmeticCatalog.Cosmetic cosmetic) {
        CosmeticPixelArt.PixelArt art = cosmetic.art();
        List<Quad> out = new ArrayList<>();
        switch (cosmetic.kind()) {
            case HAT -> extrude(out, art,
                    new float[]{-art.width() / 2f, -8.6f - art.height(), -4.5f},
                    new float[]{1, 0, 0},
                    new float[]{0, 1, 0},
                    9f);
            case CAPE -> extrude(out, art,
                    new float[]{-art.width() / 2f, 0.5f, 2.6f},
                    new float[]{1, 0, 0},
                    new float[]{0, 0.966f, 0.259f}, // one pixel down the cape's 15°-tilted hang
                    0.6f);
            case WINGS -> {
                // Art is the right wing on a swept-back parallelogram; silhouette comes from the
                // art's transparency. Mirroring x for the left wing flips winding, which the
                // double-sided emission already absorbs.
                float[] a = { 0.5f, 1.5f, 3.0f };   // inner top (at the shoulder blades)
                float[] b = { 12f, -4.5f, 7.5f };   // outer top (up, out, and back)
                float[] d = { 0.5f, 11f, 3.6f };    // inner bottom
                for (int mirror = 1; mirror >= -1; mirror -= 2) {
                    float m = mirror;
                    extrude(out, art,
                            new float[]{a[0] * m, a[1], a[2]},
                            new float[]{(b[0] - a[0]) * m / art.width(), (b[1] - a[1]) / art.width(), (b[2] - a[2]) / art.width()},
                            new float[]{(d[0] - a[0]) * m / art.height(), (d[1] - a[1]) / art.height(), (d[2] - a[2]) / art.height()},
                            0.6f);
                }
            }
            default -> { }
        }
        return out;
    }

    /**
     * Vanilla-item-style extrusion of a pixel grid placed on the plane (origin + x*u + y*v), all in
     * model pixels: front and back faces for every opaque pixel (merged along same-color runs), and
     * edge faces only where the neighboring pixel is transparent or out of bounds. Two adjacent
     * different-colored pixels get NO face between them - that face would be interior, and its two
     * copies would be coplanar.
     */
    private static void extrude(List<Quad> out, CosmeticPixelArt.PixelArt art,
                                float[] origin, float[] u, float[] v, float depthPx) {
        // Extrusion vector: unit normal of the art plane scaled to depthPx.
        float nx = u[1] * v[2] - u[2] * v[1];
        float ny = u[2] * v[0] - u[0] * v[2];
        float nz = u[0] * v[1] - u[1] * v[0];
        float len = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
        float[] n = { nx / len * depthPx, ny / len * depthPx, nz / len * depthPx };

        // Front + back faces, merged along horizontal same-color runs.
        for (int y = 0; y < art.height(); y++) {
            int x = 0;
            while (x < art.width()) {
                int rgb = art.pixelAt(x, y);
                if (rgb < 0) {
                    x++;
                    continue;
                }
                int end = x + 1;
                while (end < art.width() && art.pixelAt(end, y) == rgb) end++;
                float[] p00 = at(origin, u, v, x, y);
                float[] p10 = at(origin, u, v, end, y);
                float[] p11 = at(origin, u, v, end, y + 1);
                float[] p01 = at(origin, u, v, x, y + 1);
                face(out, rgb, p00, p10, p11, p01);
                face(out, rgb, add(p01, n), add(p11, n), add(p10, n), add(p00, n));
                x = end;
            }
        }

        // Top/bottom edge faces, merged along runs of same color that all border transparency.
        for (int y = 0; y <= art.height(); y++) {
            int x = 0;
            while (x < art.width()) {
                int above = art.pixelAt(x, y - 1);
                int below = art.pixelAt(x, y);
                int owner = above >= 0 && below < 0 ? above : above < 0 && below >= 0 ? below : -1;
                if (owner < 0) {
                    x++;
                    continue;
                }
                int end = x + 1;
                while (end < art.width()
                        && art.pixelAt(end, y - 1) == above
                        && ((above >= 0 && art.pixelAt(end, y) < 0) || (above < 0 && art.pixelAt(end, y) == below))) {
                    end++;
                }
                float[] e0 = at(origin, u, v, x, y);
                float[] e1 = at(origin, u, v, end, y);
                // Orient toward the open (transparent) side so the baked shade lights a hat's top
                // edges as up-facing and its underside as down-facing; geometry itself is
                // double-sided either way.
                if (above < 0) {
                    face(out, owner, e0, e1, add(e1, n), add(e0, n));
                } else {
                    face(out, owner, e1, e0, add(e0, n), add(e1, n));
                }
                x = end;
            }
        }

        // Left/right edge faces, merged along vertical runs of same color that all border transparency.
        for (int x = 0; x <= art.width(); x++) {
            int y = 0;
            while (y < art.height()) {
                int left = art.pixelAt(x - 1, y);
                int right = art.pixelAt(x, y);
                int owner = left >= 0 && right < 0 ? left : left < 0 && right >= 0 ? right : -1;
                if (owner < 0) {
                    y++;
                    continue;
                }
                int end = y + 1;
                while (end < art.height()
                        && art.pixelAt(x - 1, end) == left
                        && ((left >= 0 && art.pixelAt(x, end) < 0) || (left < 0 && art.pixelAt(x, end) == right))) {
                    end++;
                }
                float[] e0 = at(origin, u, v, x, y);
                float[] e1 = at(origin, u, v, x, end);
                if (left < 0) {
                    face(out, owner, e0, e1, add(e1, n), add(e0, n));
                } else {
                    face(out, owner, e1, e0, add(e0, n), add(e1, n));
                }
                y = end;
            }
        }
    }

    private static float[] at(float[] origin, float[] u, float[] v, int x, int y) {
        return new float[]{
                origin[0] + u[0] * x + v[0] * y,
                origin[1] + u[1] * x + v[1] * y,
                origin[2] + u[2] * x + v[2] * y,
        };
    }

    private static float[] add(float[] p, float[] n) {
        return new float[]{ p[0] + n[0], p[1] + n[1], p[2] + n[2] };
    }

    /**
     * Axis-aligned colored box in model pixels, emitted through the same face pipeline. Not used by
     * the cosmetics themselves (they're all pixel extrusions) - package-private for the
     * generate-cosmetic skill's GeometryDump, whose stand-in player figure should shade exactly
     * like in-game geometry.
     */
    static void box(List<Quad> out, int rgb, float x1, float y1, float z1, float x2, float y2, float z2) {
        float[] p000 = { x1, y1, z1 };
        float[] p100 = { x2, y1, z1 };
        float[] p010 = { x1, y2, z1 };
        float[] p110 = { x2, y2, z1 };
        float[] p001 = { x1, y1, z2 };
        float[] p101 = { x2, y1, z2 };
        float[] p011 = { x1, y2, z2 };
        float[] p111 = { x2, y2, z2 };
        face(out, rgb, p000, p100, p110, p010); // front (z1)
        face(out, rgb, p101, p001, p011, p111); // back (z2)
        face(out, rgb, p000, p001, p101, p100); // top (y1 - up in y-down space)
        face(out, rgb, p010, p110, p111, p011); // bottom
        face(out, rgb, p000, p010, p011, p001); // left
        face(out, rgb, p100, p101, p111, p110); // right
    }

    /** Emits one face as two quads (both windings - see class doc) with its baked directional shade. */
    private static void face(List<Quad> out, int rgb, float[] a, float[] b, float[] c, float[] d) {
        float shade = shadeOf(a, b, c, d);
        out.add(new Quad(scaled(a, b, c, d), rgb, shade));
        out.add(new Quad(scaled(d, c, b, a), rgb, shade));
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
