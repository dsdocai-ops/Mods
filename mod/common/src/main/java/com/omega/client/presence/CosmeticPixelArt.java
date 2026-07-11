// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Pixel art definitions for gear cosmetics - every hat/cape/wings is a small pixel grid, exactly
 * like a Minecraft item texture, and CosmeticGeometry extrudes it into 3D the same way vanilla
 * extrudes held/dropped items: each opaque pixel becomes a colored cell, transparent pixels cut
 * the silhouette. Zero Minecraft imports, same sharing rule as CosmeticCatalog.
 *
 * Art is authored in a compact text format (parsed by {@link #parse}, which the generate-cosmetic
 * skill's pixelate.mjs also emits and its preview consumes - one parser, no drift):
 *
 *   - lines like "c=RRGGBB" define a palette entry (single-character key, hex color, no alpha)
 *   - every other non-blank line is one pixel row: '.' = transparent, any other char = palette key
 *   - all rows must be the same length; unknown keys or ragged rows throw at parse time,
 *     so a bad grid fails at class load / preview, never silently mid-render
 *
 * Grid sizes are free, but each kind has a canonical frame it's stretched into (see
 * CosmeticGeometry): HAT 14x9 (front silhouette, extruded through the head depth),
 * CAPE 10x16 (hung from the shoulders), WINGS 12x10 (right wing; the left is mirrored).
 */
public final class CosmeticPixelArt {
    /** One parsed grid: row-major pixels, -1 = transparent, otherwise 0xRRGGBB. */
    public record PixelArt(int width, int height, int[] pixels) {
        public int pixelAt(int x, int y) {
            if (x < 0 || y < 0 || x >= width || y >= height) return -1;
            return pixels[y * width + x];
        }
    }

    private CosmeticPixelArt() {
    }

    public static PixelArt parse(String spec) {
        Map<Character, Integer> palette = new HashMap<>();
        List<String> rows = new ArrayList<>();
        for (String rawLine : spec.split("\n")) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;
            if (line.length() >= 3 && line.charAt(1) == '=') {
                palette.put(line.charAt(0), Integer.parseInt(line.substring(2).trim(), 16));
            } else {
                rows.add(line);
            }
        }
        if (rows.isEmpty()) throw new IllegalArgumentException("pixel art has no rows");
        int width = rows.get(0).length();
        int height = rows.size();
        int[] pixels = new int[width * height];
        for (int y = 0; y < height; y++) {
            String row = rows.get(y);
            if (row.length() != width) {
                throw new IllegalArgumentException("row " + y + " is " + row.length() + " wide, expected " + width);
            }
            for (int x = 0; x < width; x++) {
                char key = row.charAt(x);
                if (key == '.') {
                    pixels[y * width + x] = -1;
                } else {
                    Integer rgb = palette.get(key);
                    if (rgb == null) throw new IllegalArgumentException("row " + y + " uses undefined palette key '" + key + "'");
                    pixels[y * width + x] = rgb;
                }
            }
        }
        return new PixelArt(width, height, pixels);
    }

    /** Obsidian top hat: dark crown and brim, brand-red band. 14x9, front silhouette. */
    public static final PixelArt OBSIDIAN_TOP_HAT = parse("""
            p=241F31
            r=E63946
            ...pppppppp...
            ...pppppppp...
            ...pppppppp...
            ...pppppppp...
            ...pppppppp...
            ...rrrrrrrr...
            ...rrrrrrrr...
            pppppppppppppp
            pppppppppppppp
            """);

    /** Navy captain's hat: peaked officer's cap, gold band with a white emblem stripe, black brim. 14x9. */
    public static final PixelArt NAVY_CAPTAIN_HAT = parse("""
            n=1B2A49
            g=D4AF37
            w=F2EFE6
            b=0D0D0D
            .....nnnn.....
            ....nnnnnn....
            ...nnnnnnnn...
            ...gggggggg...
            ...gwwwwwwg...
            ...gggggggg...
            ...nnnnnnnn...
            .gggggggggggg.
            bbbbbbbbbbbbbb
            """);

    /** Azure charm hat: blue bucket hat, domed crown flaring to a wide brim, dangling gold charm. 14x9. */
    public static final PixelArt AZURE_CHARM_HAT = parse("""
            c=5FA0D6
            a=2C5C8C
            b=1B3A57
            g=D8B34A
            h=7A5A18
            ....cccccc....
            ...aaaaaaaa...
            ..aaaaaaaaaa..
            ..baaaaaaaab..
            baaaaaaaaaaaab
            .bbbbbbbbbbbb.
            .........hh...
            .........gg...
            .........hg...
            """);

    /** Nightfall cape: crescent moon and scattered stars over black, purple flame gradient rising from a notched hem. 10x16. */
    public static final PixelArt NIGHTFALL_CAPE = parse("""
            k=000000
            m=C9B8F0
            s=F5F0FF
            p=4C2D99
            q=8B3FE8
            r=C77DFF
            kkkkkkkkkk
            kkkkkkkkkk
            kskkkkkkkk
            kkkkkkkksk
            kkkkmmkkkk
            kkkmmmkkkk
            kskmmmkkkk
            kkkkmmkksk
            kkkkskkkkk
            kkkpppkkkk
            kkpppppkkk
            kkqqqqqqkk
            kqqqqqqqqk
            rrrrrrrrrr
            rrrrrrrrrr
            .rrrrrrrr.
            """);

    /** Inferno dragon wing (right; left is mirrored by CosmeticGeometry): black bone leading edge, ember-to-shadow membrane gradient, clawed scalloped trailing edge. 12x10. */
    public static final PixelArt INFERNO_WINGS = parse("""
            k=000000
            h=FF6B4A
            m=C62839
            r=8E1B1B
            kkkkkkkkkkkk
            hhhhhhhhhhhh
            mmmmmmmmmmm.
            mmmmmmmmmmm.
            mmmmmmmmm.m.
            mmmmmmmmm...
            rrrrrrr.r...
            rrrrr.r.....
            rrrr........
            rr..........
            """);

    /** Crimson cape: gold trim top and fringed bottom, gold Ω emblem. 10x16. */
    public static final PixelArt CRIMSON_CAPE = parse("""
            c=C62839
            d=8E1C28
            g=FFD700
            gggggggggg
            dccccccccd
            dccccccccd
            dccggggccd
            dcgccccgcd
            dcgccccgcd
            dccgccgccd
            dcggccggcd
            dccccccccd
            dccccccccd
            dccccccccd
            dccccccccd
            dccccccccd
            dccccccccd
            gggggggggg
            g..g..g..g
            """);

    /** Seraph wing (right; left is mirrored by CosmeticGeometry): layered white feathers, gold top ridge. 12x10. */
    public static final PixelArt SERAPH_WINGS = parse("""
            w=F2EFE6
            s=D8D2C0
            g=FFD700
            ggggggg.....
            wwwwwwggg...
            wwwwwwwwgg..
            swwwwwwwwg..
            swwwwwwwww..
            .swwwwwwwww.
            .sww.wwwwww.
            ..sw.www.ww.
            ..s..ww..ww.
            .....w...w..
            """);
}
