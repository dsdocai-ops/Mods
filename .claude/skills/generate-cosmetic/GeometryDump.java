// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Dev-only tool for the generate-cosmetic skill - NOT shipped with the mod, never on its classpath.
 * Compiled by preview-cosmetic.mjs together with the real CosmeticCatalog/CosmeticGeometry/
 * CosmeticPixelArt sources (all javac-compilable standalone: zero Minecraft imports), then run to
 * dump, as JSON, the exact quads the mod will render - through the production pixel-art parser and
 * extruder, so preview and in-game shape cannot drift. Also emits a blocky stand-in player figure
 * built with the same package-private box() helper so the preview's shading matches in-game
 * shading. Declared in this package purely to reach that helper.
 *
 * Modes:
 *   (no args)              - dump every gear cosmetic in the catalog, keyed by id
 *   <artFile> <kind>       - dump a CANDIDATE art file (CosmeticPixelArt text format) extruded as
 *                            hat|cape|wings, for previewing art before it's wired into the catalog
 *
 * Output: {"player":[quad...],"cosmetics":{"<id>":{"kind":"cape","quads":[quad...]},...}}
 *         where quad = {"p":[12 floats],"rgb":int,"shade":float}; candidate mode uses the id
 *         "candidate".
 */
public final class GeometryDump {
    public static void main(String[] args) throws Exception {
        StringBuilder json = new StringBuilder("{");
        appendPlayer(json);
        json.append("\"cosmetics\":{");
        if (args.length >= 2) {
            String spec = Files.readString(Path.of(args[0]));
            CosmeticCatalog.Kind kind = CosmeticCatalog.Kind.valueOf(args[1].toUpperCase());
            CosmeticCatalog.Cosmetic candidate = new CosmeticCatalog.Cosmetic(
                    "candidate", kind, CosmeticCatalog.DEFAULT_BADGE_RGB, CosmeticPixelArt.parse(spec));
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
        json.append("{\"p\":[");
        float[] p = quad.positions();
        for (int i = 0; i < p.length; i++) {
            if (i > 0) json.append(",");
            json.append(p[i]);
        }
        json.append("],\"rgb\":").append(quad.rgb()).append(",\"shade\":").append(quad.shade()).append("}");
    }
}
