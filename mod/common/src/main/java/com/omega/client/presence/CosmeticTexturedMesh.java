// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.ArrayList;
import java.util.List;

/**
 * A textured alternative to CosmeticGeometry's flat-extruded solid-color pixel art: real UV-mapped
 * geometry meant to be drawn with an actual PNG bound (RenderType.entityCutoutNoCull / Forge's
 * equivalent - see CosmeticFeatureRenderer/CosmeticRenderLayer), the same technique vanilla uses for
 * its own player capes. Where CosmeticGeometry turns a coarse pixel grid into many small solid-color
 * cells, this turns a texture reference into a small number of UV-mapped quads - so a texture can
 * carry real gradients, soft glow, and detail no flat-color pixel grid could represent, at the cost
 * of needing an actual image asset (see mod/README.md and the generate-cosmetic skill for where
 * those live and how they're authored).
 *
 * Zero Minecraft imports, same sharing rule as CosmeticGeometry - reuses that class's scaled /
 * scaledPoint / shadeOf helpers verbatim (widened to package-private there) rather than duplicating
 * the PX unit-scale and flat-shade lighting model, so the two rendering paths can never drift out of
 * visual sync with each other.
 *
 * CAPE only for now: a cape is naturally a flat hung plane (vanilla's own cape is exactly that), so
 * UV-mapping it is a direct, low-risk 0..1-over-the-whole-surface unwrap. HAT/WINGS stay procedural-
 * only until a textured frame is designed for them (a hat's real 3D volume UV-unwraps far less
 * trivially than a flat plane - not attempted here).
 */
public final class CosmeticTexturedMesh {
    /**
     * One quad of a textured surface: position + UV (matching CosmeticGeometry.Quad's positions
     * convention 1:1 in vertex order) + a baked face normal (for the lit render type's own diffuse
     * shading - computed once from the REST pose, not recomputed per animated frame, same "baked,
     * not dynamic" simplification CosmeticGeometry's shade already makes) + a baked directional
     * shade multiplier (this class's OWN stylized tint, layered on top of Minecraft's normal-based
     * lighting - same flat-shade look the procedural cosmetics already have, so a textured and a
     * procedural cosmetic read as part of the same visual system) + pivot/depth01 for
     * CosmeticAnimation (animatePoint, not animate - a TexturedQuad has no rgb field, so it doesn't
     * fit CosmeticGeometry.Quad's shape; see the renderers for how they animate each vertex).
     */
    public record TexturedQuad(float[] positions, float[] uv, float[] normal, float shade, float[] pivot, float depth01) {
    }

    /** Reasonable cloth-like default for capeStrips - see that method's doc for why strip count matters for how the sway looks. */
    public static final int DEFAULT_CAPE_STRIPS = 8;

    // Matches CosmeticPixelArt's canonical CAPE grid (10x16) exactly, so a textured cape hangs with
    // the same silhouette bounds/tilt/length as a procedural one - kept as its own constant (not
    // read from any PixelArt, since a textured cosmetic has none) and also used by
    // CosmeticGeometry.tipPointsFor's CAPE branch when a cosmetic has a textureId instead of art.
    static final float CAPE_FRAME_WIDTH = 10f;
    static final float CAPE_FRAME_HEIGHT = 16f;

    private CosmeticTexturedMesh() {
    }

    /**
     * A cape as horizontal cloth-like strips, not one rigid plane: CosmeticAnimation rotates each
     * returned quad's vertices by ITS OWN depth01, so a single full-height quad would sway as one
     * flat rigid slab - splitting it into stripCount thin horizontal strips (each with its own
     * depth01 at its vertical midpoint, exactly like the many small quads of a procedural cape
     * already get "for free" from being pixel-sized) lets the same per-vertex rotation bend the
     * cape progressively from a rigid collar to a freely-swinging hem. Fewer strips reads as more
     * rigid/cardboard-like; more strips costs quads for a bend refinement nobody will see - 8 is a
     * reasonable middle ground (DEFAULT_CAPE_STRIPS).
     *
     * UV mapping is the whole texture, 0..1 top-to-bottom in strict strip order (row 0 of the
     * source image is the collar, the last row is the hem) - matching how CosmeticPixelArt's own
     * art rows are already authored top-to-bottom, so converting between the two conventions never
     * needs a V-flip.
     */
    public static List<TexturedQuad> capeStrips(int stripCount) {
        float[] origin = { -CAPE_FRAME_WIDTH / 2f, 0.5f, 2.6f };
        float[] u = { 1, 0, 0 };
        float[] v = { 0, 0.966f, 0.259f }; // matches CosmeticGeometry's CAPE tilt exactly
        float[] pivot = CosmeticGeometry.scaledPoint(new float[]{
                origin[0] + u[0] * CAPE_FRAME_WIDTH / 2f,
                origin[1] + u[1] * CAPE_FRAME_WIDTH / 2f,
                origin[2] + u[2] * CAPE_FRAME_WIDTH / 2f,
        });

        List<TexturedQuad> out = new ArrayList<>(stripCount * 2);
        for (int i = 0; i < stripCount; i++) {
            float y0 = CAPE_FRAME_HEIGHT * i / stripCount;
            float y1 = CAPE_FRAME_HEIGHT * (i + 1) / stripCount;
            float depth01 = (i + 0.5f) / stripCount;
            float v0 = (float) i / stripCount;
            float v1 = (float) (i + 1) / stripCount;

            float[] p00 = at(origin, u, v, 0, y0);
            float[] p10 = at(origin, u, v, CAPE_FRAME_WIDTH, y0);
            float[] p11 = at(origin, u, v, CAPE_FRAME_WIDTH, y1);
            float[] p01 = at(origin, u, v, 0, y1);

            float[] normal = CosmeticGeometry.normalOf(p00, p10, p11, p01);
            float shade = CosmeticGeometry.shadeOf(p00, p10, p11, p01);

            // Double-sided (both windings), same convention as CosmeticGeometry's face() - visible
            // whichever way the debug-quads-adjacent textured render type ends up culling.
            out.add(new TexturedQuad(
                    CosmeticGeometry.scaled(p00, p10, p11, p01),
                    new float[]{ 0, v0, 1, v0, 1, v1, 0, v1 },
                    normal, shade, pivot, depth01));
            float[] backNormal = { -normal[0], -normal[1], -normal[2] };
            out.add(new TexturedQuad(
                    CosmeticGeometry.scaled(p01, p11, p10, p00),
                    new float[]{ 0, v1, 1, v1, 1, v0, 0, v0 },
                    backNormal, shade, pivot, depth01));
        }
        return out;
    }

    private static float[] at(float[] origin, float[] u, float[] v, float x, float y) {
        return new float[]{
                origin[0] + u[0] * x + v[0] * y,
                origin[1] + u[1] * x + v[1] * y,
                origin[2] + u[2] * x + v[2] * y,
        };
    }
}
