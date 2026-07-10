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
 * Draws the worn cosmetic of every player known to be running Omega Client - hats on the head, capes
 * and wings on the back (type comes from CosmeticCatalog.typeOf, color from colorFor, the same map
 * that tints the Ω name badge). The worn counterpart to the name badge, gated by the same
 * showOmegaUsersEnabled toggle. Reuses only render paths this mod has proven: the AFTER_TRANSLUCENT
 * world-render hook and the WireBoxRenderer wire-box primitive.
 *
 * v1 is wireframe and axis-aligned; the head hat lands where the head is, but the back cosmetics
 * (cape/wings) only offset behind the body - they don't yet rotate their faces to follow the body,
 * and the "behind" sign, offsets and scale all still need on-client visual tuning (which can't be
 * done from the launcher's dev sandbox). A solid, textured, bone-attached model is the follow-up.
 */
public final class CosmeticRenderer {
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
            CosmeticCatalog.Slot slot = CosmeticCatalog.typeOf(cosmeticId);
            if (slot == null) continue;
            if (!OmegaPresence.isOmegaUser(player.getUuid())) continue;

            int rgb = CosmeticCatalog.colorFor(cosmeticId);
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;

            double px = MathHelper.lerp(tickDelta, player.prevX, player.getX());
            double py = MathHelper.lerp(tickDelta, player.prevY, player.getY()) - (player.isSneaking() ? 0.25 : 0.0);
            double pz = MathHelper.lerp(tickDelta, player.prevZ, player.getZ());

            switch (slot) {
                case HAT -> drawHat(matrices, buffer, px, py, pz, r, g, b);
                case CAPE -> drawBack(matrices, buffer, px, py, pz, player.bodyYaw, r, g, b, false);
                case WINGS -> drawBack(matrices, buffer, px, py, pz, player.bodyYaw, r, g, b, true);
            }
        }

        matrices.pop();
    }

    private static void drawHat(MatrixStack m, VertexConsumer buf, double px, double py, double pz, float r, float g, float b) {
        double baseY = py + HAT_BASE_Y;
        WireBoxRenderer.drawBox(m, buf, px - 0.32, baseY, pz - 0.32, px + 0.32, baseY + 0.04, pz + 0.32, r, g, b, 1f);
        WireBoxRenderer.drawBox(m, buf, px - 0.20, baseY + 0.04, pz - 0.20, px + 0.20, baseY + 0.32, pz + 0.20, r, g, b, 1f);
    }

    /** Cape/wings sit behind the torso, offset opposite the body's facing. Wings flare wider + higher. */
    private static void drawBack(MatrixStack m, VertexConsumer buf, double px, double py, double pz, float bodyYaw, float r, float g, float b, boolean wings) {
        double yawRad = Math.toRadians(bodyYaw);
        // Forward at pitch 0 is (-sin, cos); behind is the opposite.
        double cx = px + Math.sin(yawRad) * 0.22;
        double cz = pz - Math.cos(yawRad) * 0.22;
        if (wings) {
            WireBoxRenderer.drawBox(m, buf, cx - 0.55, py + 1.00, cz - 0.04, cx - 0.05, py + 1.80, cz + 0.04, r, g, b, 1f);
            WireBoxRenderer.drawBox(m, buf, cx + 0.05, py + 1.00, cz - 0.04, cx + 0.55, py + 1.80, cz + 0.04, r, g, b, 1f);
        } else {
            WireBoxRenderer.drawBox(m, buf, cx - 0.28, py + 0.35, cz - 0.04, cx + 0.28, py + 1.45, cz + 0.04, r, g, b, 1f);
        }
    }
}
