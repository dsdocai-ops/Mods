package com.omega.client.forge.schematic;

import com.omega.client.schematic.SchematicBlockEntry;
import com.omega.client.schematic.SchematicData;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.NbtIo;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Forge-side twin of the Fabric LitematicaImporter - identical logic and identical caveats (see
 * that class's doc: this is reconstructed from memory of an undocumented format, not verified
 * against a real file, in a different risk category from the rest of this mod). The only changes
 * here are official-mappings NBT class names: NbtCompound -> CompoundTag, NbtList -> ListTag,
 * getKeys() -> getAllKeys(). NbtIo's name is assumed unchanged (a case where both mapping sets
 * plausibly converge on the same simple utility-class name), but that's still unverified.
 */
public final class LitematicaImporter {
    private static final long MAX_VOLUME = 250_000;
    private static final int NBT_COMPOUND_TYPE = 10; // Stable NBT binary spec tag id, not a Minecraft API detail.

    private LitematicaImporter() {
    }

    public static SchematicData importFile(Path file, String schematicName) throws IOException {
        CompoundTag root;
        try (InputStream in = Files.newInputStream(file)) {
            root = NbtIo.readCompressed(in);
        }

        if (!root.contains("Regions")) {
            throw new IOException("Doesn't look like a .litematic file (no \"Regions\" tag).");
        }
        CompoundTag regions = root.getCompound("Regions");
        String firstRegionKey = regions.getAllKeys().stream().findFirst()
                .orElseThrow(() -> new IOException("No regions found in " + file.getFileName()));
        CompoundTag region = regions.getCompound(firstRegionKey);

        CompoundTag position = region.getCompound("Position");
        CompoundTag size = region.getCompound("Size");
        int posX = position.getInt("x");
        int posY = position.getInt("y");
        int posZ = position.getInt("z");
        int sizeX = size.getInt("x");
        int sizeY = size.getInt("y");
        int sizeZ = size.getInt("z");

        int absSizeX = Math.abs(sizeX);
        int absSizeY = Math.abs(sizeY);
        int absSizeZ = Math.abs(sizeZ);
        long volume = (long) absSizeX * absSizeY * absSizeZ;
        if (volume > MAX_VOLUME) {
            throw new IOException("Region is too large (" + volume + " blocks, max " + MAX_VOLUME + ").");
        }

        List<String> palette = readPalette(region);
        long[] packedStates = region.getLongArray("BlockStates");
        int bitsPerEntry = Math.max(2, 32 - Integer.numberOfLeadingZeros(Math.max(1, palette.size() - 1)));

        SchematicData data = new SchematicData();
        data.name = schematicName;
        data.width = absSizeX;
        data.height = absSizeY;
        data.length = absSizeZ;

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

    private static List<String> readPalette(CompoundTag region) {
        List<String> palette = new ArrayList<>();
        ListTag paletteList = region.getList("BlockStatePalette", NBT_COMPOUND_TYPE);
        for (int i = 0; i < paletteList.size(); i++) {
            CompoundTag entry = paletteList.getCompound(i);
            StringBuilder sb = new StringBuilder(entry.getString("Name"));
            if (entry.contains("Properties")) {
                CompoundTag props = entry.getCompound("Properties");
                List<String> keys = new ArrayList<>(props.getAllKeys());
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
