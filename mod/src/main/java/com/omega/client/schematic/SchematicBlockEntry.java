package com.omega.client.schematic;

/** One non-air block in a schematic, position relative to the schematic's own origin corner. */
public class SchematicBlockEntry {
    public int x;
    public int y;
    public int z;
    /** Block registry id only (e.g. "minecraft:stone") - orientation/state properties are not captured, see SchematicData. */
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
