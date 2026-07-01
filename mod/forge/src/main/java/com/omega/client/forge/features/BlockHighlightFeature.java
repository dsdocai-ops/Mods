package com.omega.client.forge.features;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.omega.client.forge.ModConfig;
import com.omega.client.forge.render.WireBoxRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/**
 * Forge-side twin of the Fabric BlockHighlightFeature - identical scan-budgeting and
 * depth-tested-wireframe logic (see that class's doc for the reasoning). Renders from plain
 * vanilla parameters rather than a Fabric-style event wrapper, same as SchematicRenderFeature.
 * Renames vs. Yarn: World -> Level, Identifier -> ResourceLocation, Registries -> BuiltInRegistries,
 * BlockPos.iterate -> betweenClosed, pos.toImmutable() -> pos.immutable().
 */
public final class BlockHighlightFeature {
    private static final int SCAN_RADIUS = 20;
    private static final int RESCAN_INTERVAL_TICKS = 10;
    private static final int MAX_HIGHLIGHTS = 400;
    private static final int BLOCKS_PER_TICK_BUDGET = 4096;

    private final List<BlockPos> cachedMatches = new ArrayList<>();
    private final List<BlockPos> pendingMatches = new ArrayList<>();
    private Iterator<BlockPos> scanIterator = null;
    private Set<ResourceLocation> currentTargets = Set.of();
    private int ticksSinceScanStart = RESCAN_INTERVAL_TICKS;

    private String lastParsedColorSource = null;
    private float[] lastParsedColor = {0.6f, 0.2f, 1.0f, 0.75f};

    public void tick(ModConfig config, Level level, BlockPos center) {
        if (!config.blockHighlightEnabled || level == null || center == null) {
            cachedMatches.clear();
            scanIterator = null;
            return;
        }

        if (scanIterator == null) {
            ticksSinceScanStart++;
            if (ticksSinceScanStart < RESCAN_INTERVAL_TICKS) return;
            ticksSinceScanStart = 0;
            startScan(config, center);
        }

        advanceScan(level);
    }

    private void startScan(ModConfig config, BlockPos center) {
        Set<ResourceLocation> targets = new HashSet<>();
        for (String id : config.highlightedBlocks) {
            ResourceLocation parsed = ResourceLocation.tryParse(id);
            if (parsed != null) targets.add(parsed);
        }
        currentTargets = targets;

        BlockPos min = center.offset(-SCAN_RADIUS, -SCAN_RADIUS, -SCAN_RADIUS);
        BlockPos max = center.offset(SCAN_RADIUS, SCAN_RADIUS, SCAN_RADIUS);
        scanIterator = BlockPos.betweenClosed(min, max).iterator();
        pendingMatches.clear();
    }

    /** Processes at most BLOCKS_PER_TICK_BUDGET positions from the in-progress scan, publishing results once it completes. */
    private void advanceScan(Level level) {
        int processed = 0;
        while (scanIterator.hasNext() && processed < BLOCKS_PER_TICK_BUDGET && pendingMatches.size() < MAX_HIGHLIGHTS) {
            BlockPos pos = scanIterator.next();
            ResourceLocation blockId = BuiltInRegistries.BLOCK.getKey(level.getBlockState(pos).getBlock());
            if (currentTargets.contains(blockId)) {
                pendingMatches.add(pos.immutable());
            }
            processed++;
        }

        if (!scanIterator.hasNext() || pendingMatches.size() >= MAX_HIGHLIGHTS) {
            cachedMatches.clear();
            cachedMatches.addAll(pendingMatches);
            scanIterator = null;
        }
    }

    public void render(PoseStack matrices, MultiBufferSource consumers, Vec3 camPos, ModConfig config) {
        if (!config.blockHighlightEnabled || cachedMatches.isEmpty()) return;

        float[] rgba = resolveColor(config.highlightColorArgb);
        VertexConsumer buffer = consumers.getBuffer(RenderType.lines());

        matrices.pushPose();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (BlockPos pos : cachedMatches) {
            WireBoxRenderer.drawBoxOutline(matrices, buffer, pos, rgba[0], rgba[1], rgba[2], rgba[3]);
        }

        matrices.popPose();
    }

    /** Parses "#AARRGGBB" or "#RRGGBB" into normalized [r,g,b,a], cached so repeated per-frame calls don't re-parse an unchanged string. */
    private float[] resolveColor(String argb) {
        if (argb.equals(lastParsedColorSource)) return lastParsedColor;
        lastParsedColorSource = argb;
        lastParsedColor = parseColor(argb);
        return lastParsedColor;
    }

    private float[] parseColor(String argb) {
        try {
            String hex = argb.startsWith("#") ? argb.substring(1) : argb;
            if (hex.length() == 6) hex = "FF" + hex;
            long value = Long.parseLong(hex, 16);
            float a = ((value >> 24) & 0xFF) / 255f;
            float r = ((value >> 16) & 0xFF) / 255f;
            float g = ((value >> 8) & 0xFF) / 255f;
            float b = (value & 0xFF) / 255f;
            return new float[]{r, g, b, a};
        } catch (Exception e) {
            return new float[]{0.6f, 0.2f, 1.0f, 0.75f};
        }
    }
}
