package com.omega.client.schematic;

import java.util.ArrayList;
import java.util.List;

/**
 * Omega Client's own schematic format ("Omega Schematic", .omschem.json) - plain JSON via Gson,
 * not an attempt at Litematica's binary .litematic format. That format is proprietary/undocumented
 * and this project has no way to verify byte-for-byte compatibility without a real game session to
 * test against, so this trades exact compatibility with the real Litematica mod for something we
 * can actually be confident is correct: a simple, human-inspectable format with the same core
 * capability (capture a region, later render it as a ghost preview to build against).
 *
 * Known limitation: only the block's registry id is stored, not block-state properties (facing,
 * waterlogged, stair shape, etc.) - see SchematicCaptureFeature for why.
 */
public class SchematicData {
    public String name;
    public int formatVersion = 1;
    public int width;
    public int height;
    public int length;
    public List<SchematicBlockEntry> blocks = new ArrayList<>();
}
