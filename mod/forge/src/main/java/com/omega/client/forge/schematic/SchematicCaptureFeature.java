// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.schematic;

import com.omega.client.schematic.SchematicBlockEntry;
import com.omega.client.schematic.SchematicData;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Forge-side twin of the Fabric SchematicCaptureFeature. Renames vs. Yarn: World -> Level
 * (well-established, high confidence), BlockPos.iterate(...) -> BlockPos.betweenClosed(...)
 * (moderate confidence). Imports SchematicData/SchematicBlockEntry from the shared common module -
 * see mod/README.md for why those two are the only classes actually shared between loaders.
 */
public final class SchematicCaptureFeature {
    /** ~63^3 blocks - large enough for a small-to-mid build, small enough to capture in well under a second. */
    private static final long MAX_VOLUME = 250_000;

    public SchematicData capture(Level level, SchematicSelection selection, String name) {
        if (!selection.isComplete()) {
            throw new IllegalStateException("Both positions must be set before saving a schematic.");
        }
        long volume = selection.volume();
        if (volume > MAX_VOLUME) {
            throw new IllegalArgumentException("Selection is too large (" + volume + " blocks, max " + MAX_VOLUME + "). Pick a smaller region.");
        }

        BlockPos min = selection.getMin();
        BlockPos max = selection.getMax();

        SchematicData data = new SchematicData();
        data.name = name;
        data.width = max.getX() - min.getX() + 1;
        data.height = max.getY() - min.getY() + 1;
        data.length = max.getZ() - min.getZ() + 1;

        for (BlockPos pos : BlockPos.betweenClosed(min, max)) {
            BlockState state = level.getBlockState(pos);
            if (state.isAir()) continue;
            String blockString = BlockStateCodec.serialize(state);
            data.blocks.add(new SchematicBlockEntry(pos.getX() - min.getX(), pos.getY() - min.getY(), pos.getZ() - min.getZ(), blockString));
        }

        return data;
    }
}
