// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.schematic;

/** One non-air block in a schematic, position relative to the schematic's own origin corner. */
public class SchematicBlockEntry {
    public int x;
    public int y;
    public int z;
    /** Full block state string, e.g. "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]" - see BlockStateCodec. */
    public String block;

    public SchematicBlockEntry() {
    }

    public SchematicBlockEntry(int x, int y, int z, String block) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.block = block;
    }
}
