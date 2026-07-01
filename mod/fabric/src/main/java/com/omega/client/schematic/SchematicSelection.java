package com.omega.client.schematic;

import net.minecraft.util.math.BlockPos;

/** Tracks the two corner positions the player has marked, WorldEdit-style. */
public final class SchematicSelection {
    private BlockPos pos1;
    private BlockPos pos2;

    public void setPos1(BlockPos pos) {
        this.pos1 = pos;
    }

    public void setPos2(BlockPos pos) {
        this.pos2 = pos;
    }

    public BlockPos getPos1() {
        return pos1;
    }

    public BlockPos getPos2() {
        return pos2;
    }

    public boolean isComplete() {
        return pos1 != null && pos2 != null;
    }

    public BlockPos getMin() {
        return new BlockPos(
                Math.min(pos1.getX(), pos2.getX()),
                Math.min(pos1.getY(), pos2.getY()),
                Math.min(pos1.getZ(), pos2.getZ())
        );
    }

    public BlockPos getMax() {
        return new BlockPos(
                Math.max(pos1.getX(), pos2.getX()),
                Math.max(pos1.getY(), pos2.getY()),
                Math.max(pos1.getZ(), pos2.getZ())
        );
    }

    public long volume() {
        if (!isComplete()) return 0;
        BlockPos min = getMin();
        BlockPos max = getMax();
        return (long) (max.getX() - min.getX() + 1) * (max.getY() - min.getY() + 1) * (max.getZ() - min.getZ() + 1);
    }
}
