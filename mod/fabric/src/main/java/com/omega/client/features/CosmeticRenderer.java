// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.OmegaPresence;
import com.omega.client.render.SolidBoxRenderer;
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
 * that tints the Ω name badge). Visibility is its own settings group (see ModConfig's
 * cosmeticsMasterEnabled/showOwnCosmeticsEnabled/showOthersCosmeticsEnabled/*CosmeticsEnabled
 * fields, set via the in-game Cosmetics... screen) - deliberately independent of showOmegaUsersEnabled,
 * which only controls the Ω name badge. Reuses only render paths this mod has proven: the
 * AFTER_TRANSLUCENT world-render hook and a filled-box primitive (SolidBoxRenderer, over vanilla's
 * debugFilledBox layer).
 *
 * v1 draws solid colored boxes, axis-aligned; the head hat lands where the head is, but the back cosmetics
 * (cape/wings) only offset behind the body - they don't yet rotate their faces to follow the body,
 * and the "behind" sign, offsets and scale all still need on-client visual tuning (which can't be
 * done from the launcher's dev sandbox). A solid, textured, bone-attached model is the follow-up.
 */
public final class CosmeticRenderer {
    private static final double HAT_BASE_Y = 1.85;

    public void render(WorldRenderContext context, ModConfig config) {
        if (!config.cosmeticsMasterEnabled) return;
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null) return;
        VertexConsumerProvider consumers = context.consumers();
        if (consumers == null) return;

        float tickDelta = context.tickDelta();
        Vec3d camPos = context.camera().getPos();
        MatrixStack matrices = context.matrixStack();
        VertexConsumer buffer = consumers.getBuffer(RenderLayer.getDebugFilledBox());

        matrices.push();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (PlayerEntity player : client.world.getPlayers()) {
            if (player.isInvisible()) continue;
            if (!OmegaPresence.isOmegaUser(player.getUuid())) continue;
            boolean isSelf = player == client.player;
            if (isSelf ? !config.showOwnCosmeticsEnabled : !config.showOthersCosmeticsEnabled) continue;
            OmegaPresence.CosmeticSet set = OmegaPresence.cosmeticsOf(player.getUuid());

            double px = MathHelper.lerp(tickDelta, player.prevX, player.getX());
            double py = MathHelper.lerp(tickDelta, player.prevY, player.getY()) - (player.isSneaking() ? 0.25 : 0.0);
            double pz = MathHelper.lerp(tickDelta, player.prevZ, player.getZ());

            // A player can wear one of each slot at once, so draw every non-empty, enabled slot.
            if (config.hatCosmeticsEnabled && !set.hat().isEmpty()) drawHat(matrices, buffer, px, py, pz, rgba(set.hat()));
            if (config.capeCosmeticsEnabled && !set.cape().isEmpty()) drawBack(matrices, buffer, px, py, pz, player.bodyYaw, rgba(set.cape()), false);
            if (config.wingsCosmeticsEnabled && !set.wings().isEmpty()) drawBack(matrices, buffer, px, py, pz, player.bodyYaw, rgba(set.wings()), true);
        }

        matrices.pop();
    }

    /** Packs a cosmetic id's color into an {r,g,b} float array. */
    private static float[] rgba(String cosmeticId) {
        int rgb = CosmeticCatalog.colorFor(cosmeticId);
        return new float[] { ((rgb >> 16) & 0xFF) / 255f, ((rgb >> 8) & 0xFF) / 255f, (rgb & 0xFF) / 255f };
    }

    private static void drawHat(MatrixStack m, VertexConsumer buf, double px, double py, double pz, float[] c) {
        double baseY = py + HAT_BASE_Y;
        SolidBoxRenderer.drawBox(m, buf, px - 0.32, baseY, pz - 0.32, px + 0.32, baseY + 0.04, pz + 0.32, c[0], c[1], c[2], 1f);
        SolidBoxRenderer.drawBox(m, buf, px - 0.20, baseY + 0.04, pz - 0.20, px + 0.20, baseY + 0.32, pz + 0.20, c[0], c[1], c[2], 1f);
    }

    /** Cape/wings sit behind the torso, offset opposite the body's facing. Wings flare wider + higher. */
    private static void drawBack(MatrixStack m, VertexConsumer buf, double px, double py, double pz, float bodyYaw, float[] c, boolean wings) {
        double yawRad = Math.toRadians(bodyYaw);
        // Forward at pitch 0 is (-sin, cos); behind is the opposite.
        double cx = px + Math.sin(yawRad) * 0.22;
        double cz = pz - Math.cos(yawRad) * 0.22;
        if (wings) {
            SolidBoxRenderer.drawBox(m, buf, cx - 0.55, py + 1.00, cz - 0.04, cx - 0.05, py + 1.80, cz + 0.04, c[0], c[1], c[2], 1f);
            SolidBoxRenderer.drawBox(m, buf, cx + 0.05, py + 1.00, cz - 0.04, cx + 0.55, py + 1.80, cz + 0.04, c[0], c[1], c[2], 1f);
        } else {
            SolidBoxRenderer.drawBox(m, buf, cx - 0.28, py + 0.35, cz - 0.04, cx + 0.28, py + 1.45, cz + 0.04, c[0], c[1], c[2], 1f);
        }
    }
}
