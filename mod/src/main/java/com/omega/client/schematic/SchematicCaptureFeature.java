package com.omega.client.schematic;

import net.minecraft.block.BlockState;
import net.minecraft.registry.Registries;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

/**
 * Captures a selected region into a SchematicData. This is a deliberate one-shot action triggered
 * by a button click, not recurring per-tick work like BlockHighlightFeature's scan - so unlike that
 * feature, doing the whole region in one pass here is an acceptable, expected brief pause (the same
 * tradeoff vanilla itself makes for "Save World"), as long as the region has a sane upper bound.
 */
public final class SchematicCaptureFeature {
    /** ~63^3 blocks - large enough for a small-to-mid build, small enough to capture in well under a second. */
    private static final long MAX_VOLUME = 250_000;

    public SchematicData capture(World world, SchematicSelection selection, String name) {
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

        for (BlockPos pos : BlockPos.iterate(min, max)) {
            BlockState state = world.getBlockState(pos);
            if (state.isAir()) continue;
            String blockId = Registries.BLOCK.getId(state.getBlock()).toString();
            data.blocks.add(new SchematicBlockEntry(pos.getX() - min.getX(), pos.getY() - min.getY(), pos.getZ() - min.getZ(), blockId));
        }

        return data;
    }
}
