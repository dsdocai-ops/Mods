package com.omega.client.schematic;

/**
 * The two pieces of LitematicaImporter's parsing that are pure math/string logic with zero NBT
 * types in their signature - everything else in that class touches NbtCompound/NbtList (Yarn) vs
 * CompoundTag/ListTag (official), which differ in both package and class name between mappings, so
 * only this sliver can actually be shared. See LitematicaImporter's javadoc for the full format
 * rationale (community-reconstructed, best-effort, unverified against a real file).
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
}
