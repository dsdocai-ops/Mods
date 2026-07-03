package com.omega.client.schematic;

import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtList;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Best-effort reader for Litematica's .litematic format (GZIP-compressed NBT), converting the
 * first region in the file into an Omega SchematicData.
 *
 * IMPORTANT: unlike the rest of this mod, this is reconstructed from memory of how the format is
 * commonly described (community write-ups, other third-party readers) rather than an official
 * spec - Litematica's file format is proprietary and undocumented, and this project has no real
 * .litematic file to test this against. The block-state-palette structure and the "values can
 * span across two longs" bit-packing scheme below are the two places most likely to be subtly
 * wrong if a specific file doesn't import correctly. Treat this as genuinely best-effort. See
 * mod/README.md.
 *
 * Scope: only the first region is imported. Litematica supports multiple regions per file (an
 * advanced/multi-piece feature); merging those into one combined bounding box added enough
 * extra complexity and extra assumptions to verify that it was cut for this first version.
 */
public final class LitematicaImporter {
    private static final long MAX_VOLUME = 250_000;
    private static final int NBT_COMPOUND_TYPE = 10; // Stable NBT binary spec tag id, not a Minecraft API detail.

    private LitematicaImporter() {
    }

    public static SchematicData importFile(Path file, String schematicName) throws IOException {
        NbtCompound root;
        try (InputStream in = Files.newInputStream(file)) {
            root = NbtIo.readCompressed(in);
        }

        if (!root.contains("Regions")) {
            throw new IOException("Doesn't look like a .litematic file (no \"Regions\" tag).");
        }
        NbtCompound regions = root.getCompound("Regions");
        String firstRegionKey = regions.getKeys().stream().findFirst()
                .orElseThrow(() -> new IOException("No regions found in " + file.getFileName()));
        NbtCompound region = regions.getCompound(firstRegionKey);

        NbtCompound position = region.getCompound("Position");
        NbtCompound size = region.getCompound("Size");
        int posX = position.getInt("x");
        int posY = position.getInt("y");
        int posZ = position.getInt("z");
        int sizeX = size.getInt("x");
        int sizeY = size.getInt("y");
        int sizeZ = size.getInt("z");

        // Math.abs(int) overflows on exactly Integer.MIN_VALUE (returns the same negative value,
        // the classic Java gotcha) - a corrupted/crafted file with a Size of -2147483648 would
        // silently pass the volume guard below (a negative product is never > MAX_VOLUME) and hand
        // back a SchematicData with negative width/height/length, which callers weren't written to
        // expect. Casting to long before abs() sidesteps the overflow entirely.
        long absSizeX = Math.abs((long) sizeX);
        long absSizeY = Math.abs((long) sizeY);
        long absSizeZ = Math.abs((long) sizeZ);
        long volume = absSizeX * absSizeY * absSizeZ;
        if (volume > MAX_VOLUME) {
            throw new IOException("Region is too large (" + volume + " blocks, max " + MAX_VOLUME + ").");
        }

        List<String> palette = readPalette(region);
        long[] packedStates = region.getLongArray("BlockStates");
        int bitsPerEntry = Math.max(2, 32 - Integer.numberOfLeadingZeros(Math.max(1, palette.size() - 1)));

        SchematicData data = new SchematicData();
        data.name = schematicName;
        // Safe to narrow back to int here - the volume guard above already bounds each dimension
        // well under Integer.MAX_VALUE (a volume <= 250,000 can't have any single side larger).
        data.width = (int) absSizeX;
        data.height = (int) absSizeY;
        data.length = (int) absSizeZ;

        // Litematica's region Position/Size can encode negative growth (the region extends
        // backward from Position); we only need the size magnitude since we re-anchor to our own
        // origin on placement, so the sign of Position/Size doesn't otherwise matter here.
        int index = 0;
        for (int y = 0; y < absSizeY; y++) {
            for (int z = 0; z < absSizeZ; z++) {
                for (int x = 0; x < absSizeX; x++) {
                    int paletteIndex = readPackedEntry(packedStates, index, bitsPerEntry);
                    index++;
                    if (paletteIndex < 0 || paletteIndex >= palette.size()) continue;
                    String blockString = palette.get(paletteIndex);
                    if (isAir(blockString)) continue;
                    data.blocks.add(new SchematicBlockEntry(x, y, z, blockString));
                }
            }
        }

        return data;
    }

    private static boolean isAir(String blockString) {
        return blockString.startsWith("minecraft:air") || blockString.startsWith("minecraft:cave_air") || blockString.startsWith("minecraft:void_air");
    }

    private static List<String> readPalette(NbtCompound region) {
        List<String> palette = new ArrayList<>();
        NbtList paletteList = region.getList("BlockStatePalette", NBT_COMPOUND_TYPE);
        for (int i = 0; i < paletteList.size(); i++) {
            NbtCompound entry = paletteList.getCompound(i);
            StringBuilder sb = new StringBuilder(entry.getString("Name"));
            if (entry.contains("Properties")) {
                NbtCompound props = entry.getCompound("Properties");
                List<String> keys = new ArrayList<>(props.getKeys());
                if (!keys.isEmpty()) {
                    sb.append('[');
                    for (int k = 0; k < keys.size(); k++) {
                        if (k > 0) sb.append(',');
                        String key = keys.get(k);
                        sb.append(key).append('=').append(props.getString(key));
                    }
                    sb.append(']');
                }
            }
            palette.add(sb.toString());
        }
        return palette;
    }

    /**
     * Litematica packs palette indices into a long[] allowing a value to span across two longs -
     * unlike vanilla's own post-1.16 chunk section packing, which never splits a value across a
     * long boundary. Getting this distinction backwards is the classic mistake when reading this
     * format; this implementation intentionally allows spanning to match Litematica's scheme.
     */
    private static int readPackedEntry(long[] data, int index, int bitsPerEntry) {
        long bitOffset = (long) index * bitsPerEntry;
        int longIndex = (int) (bitOffset >> 6);
        int bitInLong = (int) (bitOffset & 0x3F);
        if (longIndex >= data.length) return -1;

        long value;
        if (bitInLong + bitsPerEntry > 64 && longIndex + 1 < data.length) {
            value = (data[longIndex] >>> bitInLong) | (data[longIndex + 1] << (64 - bitInLong));
        } else {
            value = data[longIndex] >>> bitInLong;
        }
        long mask = (1L << bitsPerEntry) - 1;
        return (int) (value & mask);
    }
}
