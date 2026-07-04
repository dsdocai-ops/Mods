// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.schematic;

/**
 * Pure math/string logic pulled out of the Litematica import path (LitematicaImporter's parsing,
 * plus SchematicScreen's filename-to-default-name step) - everything else on that path touches a
 * mapping-divergent type (NbtCompound/NbtList vs. CompoundTag/ListTag, or a GUI type in
 * SchematicScreen itself), so only these self-contained slivers can actually be shared. See
 * LitematicaImporter's javadoc for the full format rationale (community-reconstructed, best-effort,
 * unverified against a real file).
 */
public final class LitematicaBitPacking {
    private LitematicaBitPacking() {
    }

    /**
     * Litematica packs palette indices into a long[] allowing a value to span across two longs -
     * unlike vanilla's own post-1.16 chunk section packing, which never splits a value across a
     * long boundary. Getting this distinction backwards is the classic mistake when reading this
     * format; this implementation intentionally allows spanning to match Litematica's scheme.
     */
    public static int readPackedEntry(long[] data, int index, int bitsPerEntry) {
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

    public static boolean isAir(String blockString) {
        return blockString.startsWith("minecraft:air") || blockString.startsWith("minecraft:cave_air") || blockString.startsWith("minecraft:void_air");
    }

    /** Strips a ".litematic" extension for use as the imported schematic's default name. */
    public static String stripLitematicExtension(String fileName) {
        return fileName.toLowerCase().endsWith(".litematic")
                ? fileName.substring(0, fileName.length() - ".litematic".length())
                : fileName;
    }
}
