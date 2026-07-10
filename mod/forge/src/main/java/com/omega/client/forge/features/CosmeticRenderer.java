// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.features;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.omega.client.ModConfig;
import com.omega.client.forge.render.WireBoxRenderer;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.OmegaPresence;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.Vec3;

/**
 * Forge-side twin of the Fabric CosmeticRenderer: hats on the head, capes and wings on the back, for
 * every Omega Client player wearing a cosmetic (type from CosmeticCatalog.typeOf, color from
 * colorFor). Same showOmegaUsersEnabled gate, same "reuse only proven render paths" approach (the
 * wire-box primitive + the AFTER_TRANSLUCENT_BLOCKS RenderLevelStageEvent dispatch). Same v1 caveats
 * as the Fabric twin: wireframe, axis-aligned, back cosmetics need on-client tuning. Official-mappings
 * renames (xo/yo/zo, yBodyRot, isCrouching, getUUID, RenderType.lines()) match the forge WireBoxRenderer.
 */
public final class CosmeticRenderer {
    private static final double HAT_BASE_Y = 1.85;

    public void render(PoseStack matrices, MultiBufferSource consumers, Vec3 camPos, float partialTick, ModConfig config) {
        if (!config.showOmegaUsersEnabled) return;
        Minecraft client = Minecraft.getInstance();
        if (client.level == null) return;

        VertexConsumer buffer = consumers.getBuffer(RenderType.lines());
        matrices.pushPose();
        matrices.translate(-camPos.x, -camPos.y, -camPos.z);

        for (var player : client.level.players()) {
            if (player.isInvisible()) continue;
            String cosmeticId = OmegaPresence.cosmeticOf(player.getUUID());
            CosmeticCatalog.Slot slot = CosmeticCatalog.typeOf(cosmeticId);
            if (slot == null) continue;
            if (!OmegaPresence.isOmegaUser(player.getUUID())) continue;

            int rgb = CosmeticCatalog.colorFor(cosmeticId);
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;

            double px = Mth.lerp(partialTick, player.xo, player.getX());
            double py = Mth.lerp(partialTick, player.yo, player.getY()) - (player.isCrouching() ? 0.25 : 0.0);
            double pz = Mth.lerp(partialTick, player.zo, player.getZ());

            switch (slot) {
                case HAT -> drawHat(matrices, buffer, px, py, pz, r, g, b);
                case CAPE -> drawBack(matrices, buffer, px, py, pz, player.yBodyRot, r, g, b, false);
                case WINGS -> drawBack(matrices, buffer, px, py, pz, player.yBodyRot, r, g, b, true);
            }
        }

        matrices.popPose();
    }

    private static void drawHat(PoseStack m, VertexConsumer buf, double px, double py, double pz, float r, float g, float b) {
        double baseY = py + HAT_BASE_Y;
        WireBoxRenderer.drawBox(m, buf, px - 0.32, baseY, pz - 0.32, px + 0.32, baseY + 0.04, pz + 0.32, r, g, b, 1f);
        WireBoxRenderer.drawBox(m, buf, px - 0.20, baseY + 0.04, pz - 0.20, px + 0.20, baseY + 0.32, pz + 0.20, r, g, b, 1f);
    }

    private static void drawBack(PoseStack m, VertexConsumer buf, double px, double py, double pz, float bodyYaw, float r, float g, float b, boolean wings) {
        double yawRad = Math.toRadians(bodyYaw);
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
