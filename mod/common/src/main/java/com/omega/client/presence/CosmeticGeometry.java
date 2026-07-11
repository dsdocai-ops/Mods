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
 * pixel step rightward in the art), a v axis (one pixel step downward), an extrusion depth, a
 * PIVOT (the point CosmeticAnimation hinges around), and a DepthFn mapping each grid cell to a
 * depth01 (0 = rigid at the pivot, 1 = free-swinging tip - see Quad below):
 *   - HAT: a front-facing vertical plane whose bottom rests just above the hat-overlay layer
 *     (overlay top is y -8.5), extruded through the full head depth (z -4.5..+4.5), anchored to
 *     the head part - so the art is the hat's front/back silhouette. Rigid (depth01 always 0):
 *     nothing about a hat should swing loose.
 *   - CAPE: a plane hung from the shoulders, tilted ~15° back, 0.6px thin, anchored to the body.
 *     Pivot is the collar midpoint; depth01 grows down each art row, so the hem sways freely while
 *     the collar stays put.
 *   - WINGS: a swept-back parallelogram per wing (art = right wing, x-mirrored for the left),
 *     0.6px thin, anchored to the body. Pivot is the shoulder attachment; depth01 grows out each
 *     art column, so the wingtip flaps while the shoulder hinge stays put.
 *
 * Lighting is baked into each quad's shade (position-color rendering has no normals/light), using
 * vanilla's flat directional feel: up-facing 1.0, sides 0.65, down-facing 0.5. Faces are emitted
 * double-sided (both windings): the entity flip above inverts winding order, and whether the
 * debug-quads layer culls back faces isn't checkable outside CI - duplicate quads are cheaper than
 * a wrong guess that culls a cosmetic invisible.
 */
public final class CosmeticGeometry {
    /**
     * One quad: 4 vertices * xyz in model units, its palette color, and the baked lighting
     * multiplier - plus what CosmeticAnimation needs to sway/flap it at render time: pivot (the
     * point this quad hinges around, in the same model units as positions) and depth01 (0 = rigid
     * at the pivot, 1 = free tip). Animation is never baked in here: quadsFor()'s result is cached
     * and shared by every wearer, but sway/flap is time-varying and per-player, so it has to be
     * applied fresh each frame by the renderer (see CosmeticAnimation.animate).
     */
    public record Quad(float[] positions, int rgb, float shade, float[] pivot, float depth01) {
    }

    private static final float PX = 1f / 16f;

    private static final Map<String, List<Quad>> CACHE = new ConcurrentHashMap<>();

    /** Maps a grid cell to a depth01 (0 = rigid at the pivot, 1 = free tip) - see the class doc's per-kind description. */
    @FunctionalInterface
    private interface DepthFn {
        float depth(int x, int y);
    }

    private CosmeticGeometry() {
    }

    /**
     * A point CosmeticAnimation can sway/flap - the free end of a cosmetic (the cape's hem center, a
     * wingtip). Position and pivot are already PX-scaled, same unit system as Quad.positions;
     * depth01 is implicitly 1.0 (a tip is by definition the farthest point from the pivot). Used by
     * both renderers for particle trails (CosmeticTrail) - not part of the rendered mesh itself.
     */
    public record TipPoint(float[] position, float[] pivot) {
    }

    /** Empty for BADGE (badges recolor the nametag via EntityRendererMixin - no geometry) and for null. */
    public static List<Quad> quadsFor(CosmeticCatalog.Cosmetic cosmetic) {
        if (cosmetic == null || cosmetic.art() == null) return List.of();
        return CACHE.computeIfAbsent(cosmetic.id(), id -> List.copyOf(build(cosmetic)));
    }

    /**
     * The free tip(s) of a cosmetic - one for CAPE (hem center), two for WINGS (each wingtip), none
     * for HAT/BADGE (nothing free to trail from). Computed fresh each call (cheap - a couple of
     * float arrays) from the SAME origin/u/v/pivot literals as build()'s (PROCEDURAL) frames or
     * CosmeticTexturedMesh's (TEXTURED) frame; keep them in sync if a frame ever changes. Works for
     * a TEXTURED cape (art() null, textureId() set) too - CAPE's width/height come from art()'s own
     * dimensions when present, else CosmeticTexturedMesh's fixed canonical size (which is what a
     * textured cape's own geometry actually uses), so a textured cape's particle trail still hangs
     * from the right spot without needing a PixelArt at all.
     */
    public static List<TipPoint> tipPointsFor(CosmeticCatalog.Cosmetic cosmetic) {
        if (cosmetic == null) return List.of();
        return switch (cosmetic.kind()) {
            case CAPE -> {
                if (cosmetic.art() == null && cosmetic.textureId() == null) yield List.of();
                float width = cosmetic.art() != null ? cosmetic.art().width() : CosmeticTexturedMesh.CAPE_FRAME_WIDTH;
                float height = cosmetic.art() != null ? cosmetic.art().height() : CosmeticTexturedMesh.CAPE_FRAME_HEIGHT;
                float[] origin = { -width / 2f, 0.5f, 2.6f };
                float[] u = { 1, 0, 0 };
                float[] v = { 0, 0.966f, 0.259f };
                float[] pivot = { origin[0] + u[0] * width / 2f, origin[1] + u[1] * width / 2f, origin[2] + u[2] * width / 2f };
                // Hem center: origin, shifted to the horizontal midline by u*(width/2), then all the
                // way down the hang by v*height.
                float[] tip = {
                        origin[0] + u[0] * width / 2f + v[0] * height,
                        origin[1] + u[1] * width / 2f + v[1] * height,
                        origin[2] + u[2] * width / 2f + v[2] * height,
                };
                yield List.of(new TipPoint(scaledPoint(tip), scaledPoint(pivot)));
            }
            case WINGS -> {
                // Same shoulder/outer-corner points build()'s WINGS case derives its frame from -
                // b is already the wingtip (origin + u*width, since u = (b-a)/width).
                float[] a = { 0.5f, 1.5f, 3.0f };
                float[] b = { 12f, -4.5f, 7.5f };
                List<TipPoint> points = new ArrayList<>(2);
                for (int mirror = 1; mirror >= -1; mirror -= 2) {
                    float m = mirror;
                    float[] pivot = { a[0] * m, a[1], a[2] };
                    float[] tip = { b[0] * m, b[1], b[2] };
                    points.add(new TipPoint(scaledPoint(tip), scaledPoint(pivot)));
                }
                yield points;
            }
            default -> List.of();
        };
    }

    private static List<Quad> build(CosmeticCatalog.Cosmetic cosmetic) {
        CosmeticPixelArt.PixelArt art = cosmetic.art();
        List<Quad> out = new ArrayList<>();
        switch (cosmetic.kind()) {
            case HAT -> extrude(out, art,
                    new float[]{-art.width() / 2f, -8.6f - art.height(), -4.5f},
                    new float[]{1, 0, 0},
                    new float[]{0, 1, 0},
                    9f,
                    new float[]{0, 0, 0},
                    (x, y) -> 0f);
            case CAPE -> {
                float[] origin = { -art.width() / 2f, 0.5f, 2.6f };
                float[] u = { 1, 0, 0 };
                float[] v = { 0, 0.966f, 0.259f }; // one pixel down the cape's 15°-tilted hang
                float[] pivot = { origin[0] + u[0] * art.width() / 2f, origin[1] + u[1] * art.width() / 2f, origin[2] + u[2] * art.width() / 2f };
                extrude(out, art, origin, u, v, 0.6f, pivot,
                        (x, y) -> art.height() <= 1 ? 0f : y / (float) (art.height() - 1));
            }
            case WINGS -> {
                // Art is the right wing on a swept-back parallelogram; silhouette comes from the
                // art's transparency. Mirroring x for the left wing flips winding, which the
                // double-sided emission already absorbs. Pivot is the shoulder attachment (a),
                // shared by both mirrored copies (mirroring x doesn't move a point already at x=0.5
                // - close enough to the spine to treat as symmetric).
                float[] a = { 0.5f, 1.5f, 3.0f };   // inner top (at the shoulder blades)
                float[] b = { 12f, -4.5f, 7.5f };   // outer top (up, out, and back)
                float[] d = { 0.5f, 11f, 3.6f };    // inner bottom
                DepthFn wingDepth = (x, y) -> art.width() <= 1 ? 0f : x / (float) (art.width() - 1);
                for (int mirror = 1; mirror >= -1; mirror -= 2) {
                    float m = mirror;
                    float[] pivot = { a[0] * m, a[1], a[2] };
                    extrude(out, art,
                            pivot,
                            new float[]{(b[0] - a[0]) * m / art.width(), (b[1] - a[1]) / art.width(), (b[2] - a[2]) / art.width()},
                            new float[]{(d[0] - a[0]) * m / art.height(), (d[1] - a[1]) / art.height(), (d[2] - a[2]) / art.height()},
                            0.6f, pivot, wingDepth);
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
     * copies would be coplanar. Every emitted face is tagged with pivotPx (forwarded as-is; it's a
     * point, unaffected by this method) and a depth01 sampled from depthFn at the face's grid
     * position - for merged runs longer than one pixel, at the run's midpoint (exact for a DepthFn
     * that only varies along the merge axis - CAPE's row-based fn under the row-merged front/back
     * loop, WINGS's column-based fn under the column-merged left/right loop; an approximation
     * elsewhere, acceptable since this only feeds a stylized sway, not exact geometry).
     */
    private static void extrude(List<Quad> out, CosmeticPixelArt.PixelArt art,
                                float[] origin, float[] u, float[] v, float depthPx,
                                float[] pivotPx, DepthFn depthFn) {
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
                float depth01 = depthFn.depth((x + end - 1) / 2, y);
                float[] p00 = at(origin, u, v, x, y);
                float[] p10 = at(origin, u, v, end, y);
                float[] p11 = at(origin, u, v, end, y + 1);
                float[] p01 = at(origin, u, v, x, y + 1);
                face(out, rgb, depth01, pivotPx, p00, p10, p11, p01);
                face(out, rgb, depth01, pivotPx, add(p01, n), add(p11, n), add(p10, n), add(p00, n));
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
                float depth01 = depthFn.depth((x + end - 1) / 2, y);
                float[] e0 = at(origin, u, v, x, y);
                float[] e1 = at(origin, u, v, end, y);
                // Orient toward the open (transparent) side so the baked shade lights a hat's top
                // edges as up-facing and its underside as down-facing; geometry itself is
                // double-sided either way.
                if (above < 0) {
                    face(out, owner, depth01, pivotPx, e0, e1, add(e1, n), add(e0, n));
                } else {
                    face(out, owner, depth01, pivotPx, e1, e0, add(e0, n), add(e1, n));
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
                float depth01 = depthFn.depth(x, (y + end - 1) / 2);
                float[] e0 = at(origin, u, v, x, y);
                float[] e1 = at(origin, u, v, x, end);
                if (left < 0) {
                    face(out, owner, depth01, pivotPx, e0, e1, add(e1, n), add(e0, n));
                } else {
                    face(out, owner, depth01, pivotPx, e1, e0, add(e0, n), add(e1, n));
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
     * like in-game geometry. Rigid (depth01 0, pivot unused) - the stand-in body never animates.
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
        float[] noPivot = { 0, 0, 0 };
        face(out, rgb, 0f, noPivot, p000, p100, p110, p010); // front (z1)
        face(out, rgb, 0f, noPivot, p101, p001, p011, p111); // back (z2)
        face(out, rgb, 0f, noPivot, p000, p001, p101, p100); // top (y1 - up in y-down space)
        face(out, rgb, 0f, noPivot, p010, p110, p111, p011); // bottom
        face(out, rgb, 0f, noPivot, p000, p010, p011, p001); // left
        face(out, rgb, 0f, noPivot, p100, p101, p111, p110); // right
    }

    /** Emits one face as two quads (both windings - see class doc) with its baked directional shade. */
    private static void face(List<Quad> out, int rgb, float depth01, float[] pivotPx, float[] a, float[] b, float[] c, float[] d) {
        float shade = shadeOf(a, b, c, d);
        float[] pivot = scaledPoint(pivotPx);
        out.add(new Quad(scaled(a, b, c, d), rgb, shade, pivot, depth01));
        out.add(new Quad(scaled(d, c, b, a), rgb, shade, pivot, depth01));
    }

    // scaled/scaledPoint/normalOf/shadeOf are package-private (not private): CosmeticTexturedMesh
    // reuses them verbatim for its own quads, rather than duplicating this math - the PX scale
    // factor and the flat-shade lighting model must stay identical between the procedural and
    // textured rendering paths, or the two would visibly drift out of sync over time.
    static float[] scaled(float[] a, float[] b, float[] c, float[] d) {
        float[][] v = { a, b, c, d };
        float[] positions = new float[12];
        for (int i = 0; i < 4; i++) {
            positions[i * 3] = v[i][0] * PX;
            positions[i * 3 + 1] = v[i][1] * PX;
            positions[i * 3 + 2] = v[i][2] * PX;
        }
        return positions;
    }

    static float[] scaledPoint(float[] p) {
        return new float[]{ p[0] * PX, p[1] * PX, p[2] * PX };
    }

    /** Unit face normal of a quad (Newell-free cross product, fine for a planar quad) - shadeOf derives its "upness" from this. */
    static float[] normalOf(float[] a, float[] b, float[] c, float[] d) {
        float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        float vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        float nx = uy * vz - uz * vy;
        float ny = uz * vx - ux * vz;
        float nz = ux * vy - uy * vx;
        float len = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
        // y=0 (not up or down) for a degenerate/zero-area face, so shadeOf's upness-based formula
        // below falls back to its own neutral 0.65 (matching this method's pre-refactor behavior)
        // rather than reading as fully "down-facing".
        if (len < 1e-6f) return new float[]{ 0, 0, 1 };
        return new float[]{ nx / len, ny / len, nz / len };
    }

    /** Vanilla-flavored flat shade from the face normal: up-facing 1.0, vertical sides 0.65, down-facing 0.5 (y-down space, so "up" is -y). */
    static float shadeOf(float[] a, float[] b, float[] c, float[] d) {
        float[] n = normalOf(a, b, c, d);
        float upness = -n[1];
        return 0.65f + 0.35f * Math.max(0f, upness) - 0.15f * Math.max(0f, -upness);
    }
}
