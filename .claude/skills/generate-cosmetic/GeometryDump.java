// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Dev-only tool for the generate-cosmetic skill - NOT shipped with the mod, never on its classpath.
 * Compiled by preview-cosmetic.mjs together with the real CosmeticCatalog/CosmeticGeometry/
 * CosmeticPixelArt/CosmeticAnimation/CosmeticTexturedMesh sources (all javac-compilable standalone:
 * zero Minecraft imports), then run to dump, as JSON, the exact geometry the mod will render -
 * through the production pixel-art parser, extruder, textured-strip builder, and (in --animate mode)
 * the production sway/flap animator - so preview and in-game shape/motion cannot drift. Also emits a
 * blocky stand-in player figure built with the same package-private box() helper so the preview's
 * shading matches in-game shading. Declared in this package purely to reach that helper.
 *
 * Modes:
 *   (no args)                            - static dump of every gear cosmetic in the catalog, keyed by id
 *   <artFile> <kind>                     - static dump of a PROCEDURAL candidate art (hat|cape|wings), before it's
 *                                           wired in; the file may be flat OR voxel art (hat only) - parseAny detects
 *                                           which by the "---" layer separators
 *   --textured-candidate                 - static dump of a TEXTURED candidate CAPE's geometry (see CosmeticTexturedMesh for why not HAT/WINGS)
 *   --animate <id>                       - animation-frame dump of a catalog cosmetic (BADGE and a
 *                                           flat-art HAT have no mesh to move and no tip to trail
 *                                           from; a VOXEL HAT's mesh is likewise static but CAN have
 *                                           a tip point/trail - see below)
 *   --animate <artFile> <kind>           - animation-frame dump of a PROCEDURAL candidate
 *   --animate --textured-candidate       - animation-frame dump of a TEXTURED candidate CAPE
 *
 * A PROCEDURAL entry's geometry key is "quads" (color-per-quad, from CosmeticGeometry); a TEXTURED
 * entry's is "uvQuads" (UV-per-vertex + a baked normal, no color - from CosmeticTexturedMesh) plus a
 * "textureId" string. This tool doesn't load or crop the actual texture PNG - it has no notion of
 * pixels, only geometry; compositing the real image onto that geometry is the CALLER's job
 * (preview-cosmetic.mjs, which reads the PNG itself and maps it via an affine transform per quad -
 * exact, not approximate, because every quad here is a true parallelogram under this tool's
 * orthographic-friendly frame math, and an affine map is exactly what carries a parallelogram to a
 * parallelogram).
 *
 * Static output: {"player":[quad...],"cosmetics":{
 *   "<id>":{"kind":"cape","quads":[quad...]},                                   // procedural
 *   "<id>":{"kind":"cape","textured":true,"textureId":"cosmetics/x","uvQuads":[uvQuad...]}  // textured
 * }}
 * Animate output, CAPE/WINGS (the only kinds whose mesh actually moves - CosmeticAnimation.animates):
 *   {"player":[...],"kind":"cape","trailColor":16766720,
 *    "frames":[{"t":0,"motion":0,"quads":[quad...],"tips":[[x,y,z],...]},...]}    (or "uvQuads" if textured)
 * Animate output, HAT/BADGE (mesh is static - hoisted OUT of "frames" instead of repeated 12x):
 *   {"player":[...],"kind":"hat","trailColor":16766720,"quads":[quad...],
 *    "frames":[{"t":0,"motion":0,"tips":[[x,y,z],...]},...]}
 * quad = {"p":[12 floats],"rgb":int,"shade":float}
 * uvQuad = {"p":[12 floats],"uv":[8 floats],"n":[3 floats],"shade":float}
 * candidate mode uses the id "candidate" (procedural) or "candidate_textured" (textured).
 *
 * --animate samples a short, fixed window (not a full sway/flap period - CAPE's idle period alone
 * is ~5s) at two motion levels (0 = standing still, 1 = full sprint) so a reviewer can see both the
 * idle sway and the moving lean/flap without an oversized dump. CosmeticAnimation is a no-op for
 * BADGE/HAT (depth01 is always 0 for hats - nothing is meant to swing loose): the mesh (and any tip
 * point) would come back byte-for-byte identical every frame regardless of t/motion, so for those
 * kinds this tool computes the geometry once (hoisted to the top level, alongside "kind"/
 * "trailColor") instead of re-serializing it into all 12 frames - the previous version did repeat
 * it, which was harmless for a simple hat/badge but produced a large enough duplicate payload for a
 * detailed voxel hat (many small separated spikes = real surface area) to blow past a child-process
 * pipe's buffer for zero benefit, since nothing in that payload ever differed frame to frame.
 *
 * Each frame's "tips" are CosmeticGeometry.tipPointsFor(cosmetic) - the SAME local points
 * CosmeticTrail's particle spawn uses - run through the SAME CosmeticAnimation.animatePoint() call
 * as the real renderers, at that frame's t/motion (a no-op for HAT, so every frame's tip is
 * identical too, but tips are cheap - a handful of floats - so keeping them per-frame costs nothing
 * and keeps the schema uniform). "tips" is always present (empty for a flat-art HAT or BADGE, whose
 * tipPointsFor is empty; one point for a VOXEL HAT - its tallest point's peak - or CAPE; two for
 * WINGS); "trailColor" is the catalog cosmetic's own trailColor (null for candidates - loadCandidate
 * never sets one - and for any cosmetic that doesn't have one), reported so the preview can default
 * to it, but a caller may draw the tips in any color regardless of whether trailColor is set - this
 * tool doesn't decide whether a trail SHOULD render, only where its tip is. Local-space only: no
 * world/yaw placement here (that's CosmeticTrail.toWorld, deliberately not exercised by this preview
 * tool - see the skill's SKILL.md on that verification boundary).
 */
public final class GeometryDump {
    private static final float[] FRAME_TICKS = { 0f, 4f, 8f, 12f, 16f, 20f };
    private static final float[] FRAME_MOTIONS = { 0f, 1f };

    public static void main(String[] args) throws Exception {
        if (args.length >= 1 && args[0].equals("--animate")) {
            animateMode(java.util.Arrays.copyOfRange(args, 1, args.length));
        } else {
            staticMode(args);
        }
    }

    private static void staticMode(String[] args) throws Exception {
        StringBuilder json = new StringBuilder("{");
        appendPlayer(json);
        json.append("\"cosmetics\":{");
        if (args.length >= 1 && args[0].equals("--textured-candidate")) {
            appendCosmetic(json, texturedCandidate(), true);
        } else if (args.length >= 2) {
            appendCosmetic(json, loadCandidate(args[0], args[1]), true);
        } else {
            boolean first = true;
            for (CosmeticCatalog.Cosmetic cosmetic : CosmeticCatalog.all()) {
                if (cosmetic.art() == null && cosmetic.textureId() == null) continue;
                appendCosmetic(json, cosmetic, first);
                first = false;
            }
        }
        json.append("}}");
        System.out.println(json);
    }

    private static void animateMode(String[] args) throws Exception {
        CosmeticCatalog.Cosmetic cosmetic;
        if (args.length >= 1 && args[0].equals("--textured-candidate")) {
            cosmetic = texturedCandidate();
        } else if (args.length >= 2) {
            cosmetic = loadCandidate(args[0], args[1]);
        } else {
            cosmetic = CosmeticCatalog.get(args[0]);
        }
        if (cosmetic == null) {
            System.err.println("No cosmetic \"" + args[0] + "\" in the catalog.");
            System.exit(1);
            return;
        }
        List<CosmeticGeometry.TipPoint> tips = CosmeticGeometry.tipPointsFor(cosmetic);
        // HAT/BADGE never animate their MESH (CosmeticAnimation.animate/animatePoint no-op for any
        // kind but CAPE/WINGS - see that class's animates()), so re-serializing identical geometry
        // 12 times (FRAME_TICKS.length * FRAME_MOTIONS.length) is pure waste, not fidelity - for a
        // hat with real surface area (many separated spikes, say) that's easily 10x+ the necessary
        // JSON and can blow past a child-process pipe's buffer for no benefit, since every frame IS
        // byte-for-byte identical. Hoist the geometry OUT of the frame loop for these kinds; CAPE/
        // WINGS keep the full per-frame re-serialization since their mesh genuinely changes.
        boolean kindAnimates = cosmetic.kind() == CosmeticCatalog.Kind.CAPE || cosmetic.kind() == CosmeticCatalog.Kind.WINGS;

        StringBuilder json = new StringBuilder("{");
        appendPlayer(json);
        json.append("\"kind\":\"").append(cosmetic.kind().name().toLowerCase()).append("\"");
        if (cosmetic.textureId() != null) {
            json.append(",\"textured\":true,\"textureId\":\"").append(cosmetic.textureId()).append("\"");
        }
        json.append(",\"trailColor\":").append(cosmetic.trailColor());

        List<CosmeticGeometry.Quad> quads = cosmetic.textureId() == null ? CosmeticGeometry.quadsFor(cosmetic) : null;
        List<CosmeticTexturedMesh.TexturedQuad> uvQuads =
                cosmetic.textureId() != null ? CosmeticTexturedMesh.capeStrips(CosmeticTexturedMesh.DEFAULT_CAPE_STRIPS) : null;

        if (!kindAnimates) {
            // Static geometry, dumped once - t/motion are meaningless for it, so there is nothing to
            // vary. (animate()/animatePoint() would return it unchanged anyway; skip the call.)
            if (quads != null) {
                json.append(",\"quads\":[");
                for (int i = 0; i < quads.size(); i++) {
                    if (i > 0) json.append(",");
                    CosmeticGeometry.Quad quad = quads.get(i);
                    appendQuadPositions(json, quad.positions(), quad.rgb(), quad.shade());
                }
                json.append("]");
            } else {
                json.append(",\"uvQuads\":[");
                for (int i = 0; i < uvQuads.size(); i++) {
                    if (i > 0) json.append(",");
                    appendAnimatedUvQuad(json, uvQuads.get(i), cosmetic.kind(), 0f, 0f);
                }
                json.append("]");
            }
        }

        json.append(",\"frames\":[");
        boolean first = true;
        for (float motion : FRAME_MOTIONS) {
            for (float t : FRAME_TICKS) {
                if (!first) json.append(",");
                first = false;
                json.append("{\"t\":").append(t).append(",\"motion\":").append(motion);
                if (kindAnimates) {
                    if (quads != null) {
                        json.append(",\"quads\":[");
                        for (int i = 0; i < quads.size(); i++) {
                            if (i > 0) json.append(",");
                            CosmeticGeometry.Quad quad = quads.get(i);
                            float[] animated = CosmeticAnimation.animate(quad, cosmetic.kind(), t, motion);
                            appendQuadPositions(json, animated, quad.rgb(), quad.shade());
                        }
                        json.append("]");
                    } else {
                        json.append(",\"uvQuads\":[");
                        for (int i = 0; i < uvQuads.size(); i++) {
                            if (i > 0) json.append(",");
                            appendAnimatedUvQuad(json, uvQuads.get(i), cosmetic.kind(), t, motion);
                        }
                        json.append("]");
                    }
                }
                json.append(",\"tips\":[");
                for (int i = 0; i < tips.size(); i++) {
                    if (i > 0) json.append(",");
                    CosmeticGeometry.TipPoint tip = tips.get(i);
                    float[] animated = CosmeticAnimation.animatePoint(tip.position(), tip.pivot(), 1f, cosmetic.kind(), t, motion);
                    json.append("[").append(animated[0]).append(",").append(animated[1]).append(",").append(animated[2]).append("]");
                }
                json.append("]}");
            }
        }
        json.append("]}");
        System.out.println(json);
    }

    private static CosmeticCatalog.Cosmetic loadCandidate(String artFile, String kindArg) throws Exception {
        String spec = Files.readString(Path.of(artFile));
        CosmeticCatalog.Kind kind = CosmeticCatalog.Kind.valueOf(kindArg.toUpperCase());
        // parseAny: a flat grid or (hat only) a "---"-layered voxel grid - CosmeticGeometry.build
        // rejects voxel art on non-HAT kinds with a clear message, so a wrong pairing fails here
        // in the preview rather than after it's wired in.
        return new CosmeticCatalog.Cosmetic("candidate", kind, CosmeticCatalog.DEFAULT_BADGE_RGB, CosmeticPixelArt.parseAny(spec), null, null);
    }

    /** textureId is a placeholder - this tool never reads texture pixels, only geometry (see class doc). */
    private static CosmeticCatalog.Cosmetic texturedCandidate() {
        return new CosmeticCatalog.Cosmetic("candidate_textured", CosmeticCatalog.Kind.CAPE, CosmeticCatalog.DEFAULT_BADGE_RGB, null, null, "candidate");
    }

    private static void appendCosmetic(StringBuilder json, CosmeticCatalog.Cosmetic cosmetic, boolean first) {
        if (!first) json.append(",");
        json.append("\"").append(cosmetic.id()).append("\":{\"kind\":\"").append(cosmetic.kind().name().toLowerCase()).append("\"");
        if (cosmetic.textureId() != null) {
            json.append(",\"textured\":true,\"textureId\":\"").append(cosmetic.textureId()).append("\",\"uvQuads\":[");
            List<CosmeticTexturedMesh.TexturedQuad> uvQuads = CosmeticTexturedMesh.capeStrips(CosmeticTexturedMesh.DEFAULT_CAPE_STRIPS);
            for (int i = 0; i < uvQuads.size(); i++) {
                if (i > 0) json.append(",");
                appendUvQuad(json, uvQuads.get(i));
            }
            json.append("]}");
        } else {
            json.append(",\"quads\":[");
            List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(cosmetic);
            for (int i = 0; i < quads.size(); i++) {
                if (i > 0) json.append(",");
                appendQuad(json, quads.get(i));
            }
            json.append("]}");
        }
    }

    /** Steve-ish stand-in, unposed, in the same body-anchored space the gear quads use (head pivot and body pivot coincide at the neck when unposed). */
    private static void appendPlayer(StringBuilder json) {
        List<CosmeticGeometry.Quad> quads = new ArrayList<>();
        CosmeticGeometry.box(quads, 0xB78A67, -4, -8, -4, 4, 0, 4);   // head
        CosmeticGeometry.box(quads, 0x00A6A6, -4, 0, -2, 4, 12, 2);   // torso
        CosmeticGeometry.box(quads, 0x00A6A6, 4, 0, -2, 8, 12, 2);    // arms
        CosmeticGeometry.box(quads, 0x00A6A6, -8, 0, -2, -4, 12, 2);
        CosmeticGeometry.box(quads, 0x4A4A94, -4, 12, -2, 0, 24, 2);  // legs
        CosmeticGeometry.box(quads, 0x4A4A94, 0, 12, -2, 4, 24, 2);
        json.append("\"player\":[");
        for (int i = 0; i < quads.size(); i++) {
            if (i > 0) json.append(",");
            appendQuad(json, quads.get(i));
        }
        json.append("],");
    }

    private static void appendQuad(StringBuilder json, CosmeticGeometry.Quad quad) {
        appendQuadPositions(json, quad.positions(), quad.rgb(), quad.shade());
    }

    private static void appendQuadPositions(StringBuilder json, float[] p, int rgb, float shade) {
        json.append("{\"p\":[");
        for (int i = 0; i < p.length; i++) {
            if (i > 0) json.append(",");
            json.append(p[i]);
        }
        json.append("],\"rgb\":").append(rgb).append(",\"shade\":").append(shade).append("}");
    }

    private static void appendUvQuad(StringBuilder json, CosmeticTexturedMesh.TexturedQuad q) {
        appendUvQuadRaw(json, q.positions(), q.uv(), q.normal(), q.shade());
    }

    private static void appendAnimatedUvQuad(StringBuilder json, CosmeticTexturedMesh.TexturedQuad q,
                                             CosmeticCatalog.Kind kind, float ageTicks, float motion) {
        float[] p = q.positions();
        float[] animated = new float[12];
        for (int v = 0; v < 4; v++) {
            float[] rotated = CosmeticAnimation.animatePoint(
                    new float[]{ p[v * 3], p[v * 3 + 1], p[v * 3 + 2] }, q.pivot(), q.depth01(), kind, ageTicks, motion);
            animated[v * 3] = rotated[0];
            animated[v * 3 + 1] = rotated[1];
            animated[v * 3 + 2] = rotated[2];
        }
        appendUvQuadRaw(json, animated, q.uv(), q.normal(), q.shade());
    }

    private static void appendUvQuadRaw(StringBuilder json, float[] p, float[] uv, float[] n, float shade) {
        json.append("{\"p\":[");
        for (int i = 0; i < p.length; i++) {
            if (i > 0) json.append(",");
            json.append(p[i]);
        }
        json.append("],\"uv\":[");
        for (int i = 0; i < uv.length; i++) {
            if (i > 0) json.append(",");
            json.append(uv[i]);
        }
        json.append("],\"n\":[").append(n[0]).append(",").append(n[1]).append(",").append(n[2]);
        json.append("],\"shade\":").append(shade).append("}");
    }
}
