// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.OmegaPresence;
import com.omega.client.render.WireBoxRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Draws a colored "hat" above the head of every player known to be running Omega Client and wearing
 * a cosmetic - the worn counterpart to the Ω name badge (same id->color map in CosmeticCatalog, same
 * "is an Omega user" gate). Reuses the exact world-render hook and wire-box primitive
 * BlockHighlightFeature already uses, so it leans only on rendering paths this mod has proven.
 *
 * v1 is a wireframe hat (a wide thin brim + a taller crown), axis-aligned. A solid, textured,
 * head-rotation-following model is the natural next step - it needs on-client visual tuning (offsets,
 * scale, head-follow) that can't be done from the launcher's dev sandbox. Gated on
 * showOmegaUsersEnabled, exactly like the name badge, so one toggle governs both.
 */
public final class HatRenderer {
    /** A standing player's head is ~1.62-1.8m up; the brim rests just above it. */
    private static final double HAT_BASE_Y = 1.85;

    public void render(WorldRenderContext context, ModConfig config) {
        if (!config.showOmegaUsersEnabled) return;
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null) return;
        VertexConsumerProvider consumers = context.consumers();
        if (consumers == null) return;

        float tickDelta = context.tickDelta();
        Vec3d camPos = context.camera().getPos();
        MatrixStack matrices = context.matrixStack();
        VertexConsumer buffer = consumers.getBuffer(RenderLayer.getLines());

        matrices.push();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (PlayerEntity player : client.world.getPlayers()) {
            if (player.isInvisible()) continue;
            String cosmeticId = OmegaPresence.cosmeticOf(player.getUuid());
            if (cosmeticId == null || cosmeticId.isEmpty()) continue;
            if (!OmegaPresence.isOmegaUser(player.getUuid())) continue;

            int rgb = CosmeticCatalog.colorFor(cosmeticId);
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;

            // Interpolated so the hat tracks the smoothly-rendered body, not the tick-quantized one.
            double px = MathHelper.lerp(tickDelta, player.prevX, player.getX());
            double py = MathHelper.lerp(tickDelta, player.prevY, player.getY());
            double pz = MathHelper.lerp(tickDelta, player.prevZ, player.getZ());
            double baseY = py + HAT_BASE_Y - (player.isSneaking() ? 0.25 : 0.0);

            // Brim: wide + thin. Crown: narrower + taller, sitting on the brim.
            WireBoxRenderer.drawBox(matrices, buffer, px - 0.32, baseY, pz - 0.32, px + 0.32, baseY + 0.04, pz + 0.32, r, g, b, 1f);
            WireBoxRenderer.drawBox(matrices, buffer, px - 0.20, baseY + 0.04, pz - 0.20, px + 0.20, baseY + 0.32, pz + 0.20, r, g, b, 1f);
        }

        matrices.pop();
    }
}
