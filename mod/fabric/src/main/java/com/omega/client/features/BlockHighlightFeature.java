// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.ModConfig;
import com.omega.client.render.HighlightColorCache;
import com.omega.client.render.WireBoxRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/**
 * Draws a depth-tested wireframe outline around configured block types near the player.
 *
 * Deliberately depth-tested (RenderLayer.getLines(), the same layer vanilla's own F3+B hitbox
 * debug rendering uses): terrain still occludes it, so this only ever emphasizes blocks the
 * player could already see, matching "combat clarity" rather than an x-ray/wallhack.
 *
 * The scan volume (41x41x41 = ~69k blocks) is spread across many ticks instead of being scanned
 * in one go - a single-tick scan of the whole volume was measured (by inspection) to be exactly
 * the kind of unbounded per-tick work that causes a periodic frame hitch, which defeats the
 * point of a mod aimed at smooth PvP. Budgeting a fixed number of lookups per tick keeps every
 * tick's cost bounded and roughly constant instead.
 */
public final class BlockHighlightFeature {
    private static final int SCAN_RADIUS = 20;
    private static final int RESCAN_INTERVAL_TICKS = 10;
    private static final int MAX_HIGHLIGHTS = 400;
    private static final int BLOCKS_PER_TICK_BUDGET = 4096;

    private final List<BlockPos> cachedMatches = new ArrayList<>();
    private final List<BlockPos> pendingMatches = new ArrayList<>();
    private Iterator<BlockPos> scanIterator = null;
    private Set<Identifier> currentTargets = Set.of();
    private int ticksSinceScanStart = RESCAN_INTERVAL_TICKS;

    private final HighlightColorCache colorCache = new HighlightColorCache();

    public void tick(ModConfig config, World world, BlockPos center) {
        if (!config.blockHighlightEnabled || world == null || center == null) {
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

        advanceScan(world);
    }

    private void startScan(ModConfig config, BlockPos center) {
        Set<Identifier> targets = new HashSet<>();
        for (String id : config.highlightedBlocks) {
            Identifier parsed = Identifier.tryParse(id);
            if (parsed != null) targets.add(parsed);
        }
        currentTargets = targets;

        BlockPos min = center.add(-SCAN_RADIUS, -SCAN_RADIUS, -SCAN_RADIUS);
        BlockPos max = center.add(SCAN_RADIUS, SCAN_RADIUS, SCAN_RADIUS);
        scanIterator = BlockPos.iterate(min, max).iterator();
        pendingMatches.clear();
    }

    /** Processes at most BLOCKS_PER_TICK_BUDGET positions from the in-progress scan, publishing results once it completes. */
    private void advanceScan(World world) {
        int processed = 0;
        while (scanIterator.hasNext() && processed < BLOCKS_PER_TICK_BUDGET && pendingMatches.size() < MAX_HIGHLIGHTS) {
            BlockPos pos = scanIterator.next();
            Identifier blockId = Registries.BLOCK.getId(world.getBlockState(pos).getBlock());
            if (currentTargets.contains(blockId)) {
                pendingMatches.add(pos.toImmutable());
            }
            processed++;
        }

        if (!scanIterator.hasNext() || pendingMatches.size() >= MAX_HIGHLIGHTS) {
            cachedMatches.clear();
            cachedMatches.addAll(pendingMatches);
            scanIterator = null;
        }
    }

    public void render(WorldRenderContext context, ModConfig config) {
        if (!config.blockHighlightEnabled || cachedMatches.isEmpty()) return;
        VertexConsumerProvider consumers = context.consumers();
        if (consumers == null) return;

        float[] rgba = colorCache.resolve(config.highlightColorArgb);
        VertexConsumer buffer = consumers.getBuffer(RenderLayer.getLines());
        MatrixStack matrices = context.matrixStack();
        Vec3d camPos = context.camera().getPos();

        matrices.push();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (BlockPos pos : cachedMatches) {
            WireBoxRenderer.drawBoxOutline(matrices, buffer, pos, rgba[0], rgba[1], rgba[2], rgba[3]);
        }

        matrices.pop();
    }

}
