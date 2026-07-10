// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.ArrayList;
import java.util.List;

/**
 * Dev-only tool for the generate-cosmetic skill - NOT shipped with the mod, never on its classpath.
 * Compiled by preview-cosmetic.mjs together with the real CosmeticCatalog/CosmeticGeometry sources
 * (all three are javac-compilable standalone: zero Minecraft imports), then run to dump the actual
 * gear geometry the mod will render, as JSON, plus a blocky stand-in player figure built with the
 * same package-private box() helper so the preview's shading matches in-game shading. Declared in
 * this package purely to reach that helper.
 *
 * Output: {"player":[{p:[12 floats],rgb:int,shade:f}...],"hat":[{p:[...],secondary:bool,shade:f}...],"cape":[...],"wings":[...]}
 */
public final class GeometryDump {
    public static void main(String[] args) {
        StringBuilder json = new StringBuilder("{");
        appendPlayer(json);
        appendKind(json, "hat", CosmeticCatalog.Kind.HAT);
        appendKind(json, "cape", CosmeticCatalog.Kind.CAPE);
        appendKind(json, "wings", CosmeticCatalog.Kind.WINGS);
        json.append("}");
        System.out.println(json);
    }

    /** Steve-ish stand-in, unposed, in the same body-anchored space the gear quads use (head pivot and body pivot coincide at the neck when unposed). */
    private static void appendPlayer(StringBuilder json) {
        List<CosmeticGeometry.Quad> quads = new ArrayList<>();
        List<Integer> colors = new ArrayList<>();
        addBox(quads, colors, 0xB78A67, -4, -8, -4, 4, 0, 4);   // head
        addBox(quads, colors, 0x00A6A6, -4, 0, -2, 4, 12, 2);   // torso
        addBox(quads, colors, 0x00A6A6, 4, 0, -2, 8, 12, 2);    // arms
        addBox(quads, colors, 0x00A6A6, -8, 0, -2, -4, 12, 2);
        addBox(quads, colors, 0x4A4A94, -4, 12, -2, 0, 24, 2);  // legs
        addBox(quads, colors, 0x4A4A94, 0, 12, -2, 4, 24, 2);
        json.append("\"player\":[");
        for (int i = 0; i < quads.size(); i++) {
            if (i > 0) json.append(",");
            CosmeticGeometry.Quad quad = quads.get(i);
            json.append("{\"p\":").append(positions(quad))
                    .append(",\"rgb\":").append(colors.get(i))
                    .append(",\"shade\":").append(quad.shade()).append("}");
        }
        json.append("],");
    }

    private static void addBox(List<CosmeticGeometry.Quad> quads, List<Integer> colors, int rgb,
                               float x1, float y1, float z1, float x2, float y2, float z2) {
        int before = quads.size();
        CosmeticGeometry.box(quads, false, x1, y1, z1, x2, y2, z2);
        for (int i = before; i < quads.size(); i++) colors.add(rgb);
    }

    private static void appendKind(StringBuilder json, String name, CosmeticCatalog.Kind kind) {
        json.append("\"").append(name).append("\":[");
        List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(kind);
        for (int i = 0; i < quads.size(); i++) {
            if (i > 0) json.append(",");
            CosmeticGeometry.Quad quad = quads.get(i);
            json.append("{\"p\":").append(positions(quad))
                    .append(",\"secondary\":").append(quad.secondary())
                    .append(",\"shade\":").append(quad.shade()).append("}");
        }
        json.append("]");
        if (!name.equals("wings")) json.append(",");
    }

    private static String positions(CosmeticGeometry.Quad quad) {
        StringBuilder sb = new StringBuilder("[");
        float[] p = quad.positions();
        for (int i = 0; i < p.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(p[i]);
        }
        return sb.append("]").toString();
    }
}
