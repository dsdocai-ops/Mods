// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.schematic;

import java.util.ArrayList;
import java.util.List;

/**
 * Omega Client's own schematic format ("Omega Schematic", .omschem.json) - plain JSON via Gson,
 * not an attempt at Litematica's binary .litematic format. That format is proprietary/undocumented
 * and this project has no way to verify byte-for-byte write compatibility without a real game
 * session to test against, so this trades exact compatibility with the real Litematica mod for
 * something we can actually be confident is correct: a simple, human-inspectable format with the
 * same core capability (capture a region, later render it as a ghost preview to build against).
 * A best-effort *reader* for real .litematic files exists separately - see LitematicaImporter.
 *
 * formatVersion 2: each block entry stores its full state string (BlockStateCodec), not just the
 * block type. formatVersion 1 files (block type only) still load fine - missing properties just
 * fall back to each block's default state.
 */
public class SchematicData {
    public String name;
    public int formatVersion = 2;
    public int width;
    public int height;
    public int length;
    public List<SchematicBlockEntry> blocks = new ArrayList<>();
}
