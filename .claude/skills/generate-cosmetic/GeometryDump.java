// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Dev-only tool for the generate-cosmetic skill - NOT shipped with the mod, never on its classpath.
 * Compiled by preview-cosmetic.mjs together with the real CosmeticCatalog/CosmeticGeometry/
 * CosmeticPixelArt/CosmeticAnimation sources (all javac-compilable standalone: zero Minecraft
 * imports), then run to dump, as JSON, the exact quads the mod will render - through the production
 * pixel-art parser, extruder, and (in --animate mode) the production sway/flap animator - so preview
 * and in-game shape/motion cannot drift. Also emits a blocky stand-in player figure built with the
 * same package-private box() helper so the preview's shading matches in-game shading. Declared in
 * this package purely to reach that helper.
 *
 * Modes:
 *   (no args)                          - static dump of every gear cosmetic in the catalog, keyed by id
 *   <artFile> <kind>                   - static dump of CANDIDATE art (hat|cape|wings), before it's wired in
 *   --animate <id>                     - animation-frame dump of a catalog cosmetic (BADGE/HAT ids
 *                                         are accepted but every frame is identical - see below)
 *   --animate <artFile> <kind>         - animation-frame dump of CANDIDATE art
 *
 * Static output: {"player":[quad...],"cosmetics":{"<id>":{"kind":"cape","quads":[quad...]},...}}
 * Animate output: {"player":[quad...],"kind":"cape","trailColor":16766720,
 *                  "frames":[{"t":0,"motion":0,"quads":[quad...],"tips":[[x,y,z],...]},...]}
 * quad = {"p":[12 floats],"rgb":int,"shade":float}; candidate mode uses the id "candidate".
 *
 * --animate samples a short, fixed window (not a full sway/flap period - CAPE's idle period alone
 * is ~5s) at two motion levels (0 = standing still, 1 = full sprint) so a reviewer can see both the
 * idle sway and the moving lean/flap without an oversized dump. CosmeticAnimation is a no-op for
 * BADGE/HAT (depth01 is always 0 for hats - nothing is meant to swing loose), so every frame comes
 * back identical for those kinds; that's expected, not a bug in this tool.
 *
 * Each frame's "tips" are CosmeticGeometry.tipPointsFor(cosmetic) - the SAME local points
 * CosmeticTrail's particle spawn uses - run through the SAME CosmeticAnimation.animatePoint() call
 * as the real renderers, at that frame's t/motion, so a rendered trail dot swings in lockstep with
 * the mesh, exactly as it will in-game. "tips" is always present (empty for HAT/BADGE, whose
 * tipPointsFor is empty); "trailColor" is the catalog cosmetic's own trailColor (null for candidates
 * - loadCandidate never sets one - and for any cosmetic that doesn't have one), reported so the
 * preview can default to it, but a caller may draw the tips in any color regardless of whether
 * trailColor is set - this tool doesn't decide whether a trail SHOULD render, only where its tip is.
 * Local-space only: no world/yaw placement here (that's CosmeticTrail.toWorld, deliberately not
 * exercised by this preview tool - see the skill's SKILL.md on that verification boundary).
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
        if (args.length >= 2) {
            CosmeticCatalog.Cosmetic candidate = loadCandidate(args[0], args[1]);
            appendCosmetic(json, candidate, true);
        } else {
            boolean first = true;
            for (CosmeticCatalog.Cosmetic cosmetic : CosmeticCatalog.all()) {
                if (cosmetic.art() == null) continue;
                appendCosmetic(json, cosmetic, first);
                first = false;
            }
        }
        json.append("}}");
        System.out.println(json);
    }

    private static void animateMode(String[] args) throws Exception {
        CosmeticCatalog.Cosmetic cosmetic = args.length >= 2
                ? loadCandidate(args[0], args[1])
                : CosmeticCatalog.get(args[0]);
        if (cosmetic == null) {
            System.err.println("No cosmetic \"" + args[0] + "\" in the catalog.");
            System.exit(1);
            return;
        }
        List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(cosmetic);
        List<CosmeticGeometry.TipPoint> tips = CosmeticGeometry.tipPointsFor(cosmetic);

        StringBuilder json = new StringBuilder("{");
        appendPlayer(json);
        json.append("\"kind\":\"").append(cosmetic.kind().name().toLowerCase())
                .append("\",\"trailColor\":").append(cosmetic.trailColor())
                .append(",\"frames\":[");
        boolean first = true;
        for (float motion : FRAME_MOTIONS) {
            for (float t : FRAME_TICKS) {
                if (!first) json.append(",");
                first = false;
                json.append("{\"t\":").append(t).append(",\"motion\":").append(motion).append(",\"quads\":[");
                for (int i = 0; i < quads.size(); i++) {
                    if (i > 0) json.append(",");
                    CosmeticGeometry.Quad quad = quads.get(i);
                    float[] animated = CosmeticAnimation.animate(quad, cosmetic.kind(), t, motion);
                    appendQuadPositions(json, animated, quad.rgb(), quad.shade());
                }
                json.append("],\"tips\":[");
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
        return new CosmeticCatalog.Cosmetic("candidate", kind, CosmeticCatalog.DEFAULT_BADGE_RGB, CosmeticPixelArt.parse(spec), null);
    }

    private static void appendCosmetic(StringBuilder json, CosmeticCatalog.Cosmetic cosmetic, boolean first) {
        if (!first) json.append(",");
        json.append("\"").append(cosmetic.id()).append("\":{\"kind\":\"")
                .append(cosmetic.kind().name().toLowerCase()).append("\",\"quads\":[");
        List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(cosmetic);
        for (int i = 0; i < quads.size(); i++) {
            if (i > 0) json.append(",");
            appendQuad(json, quads.get(i));
        }
        json.append("]}");
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
}
