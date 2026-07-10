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
 * Forge-side twin of the Fabric HatRenderer: draws a colored wireframe "hat" above every Omega Client
 * player wearing a cosmetic, the worn counterpart to the Ω name badge. Same id->color map
 * (CosmeticCatalog), same showOmegaUsersEnabled gate, same "reuse only proven render paths" approach
 * (the wire-box primitive + the AFTER_TRANSLUCENT_BLOCKS RenderLevelStageEvent dispatch that
 * BlockHighlightFeature already uses). v1 is a wireframe hat; a solid model is a follow-up that needs
 * on-client tuning. Renames vs. Yarn are the same well-established official-mappings ones the forge
 * WireBoxRenderer documents (xo/yo/zo prev-position, isCrouching, getUUID, RenderType.lines()).
 */
public final class HatRenderer {
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
            if (cosmeticId == null || cosmeticId.isEmpty()) continue;
            if (!OmegaPresence.isOmegaUser(player.getUUID())) continue;

            int rgb = CosmeticCatalog.colorFor(cosmeticId);
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;

            double px = Mth.lerp(partialTick, player.xo, player.getX());
            double py = Mth.lerp(partialTick, player.yo, player.getY());
            double pz = Mth.lerp(partialTick, player.zo, player.getZ());
            double baseY = py + HAT_BASE_Y - (player.isCrouching() ? 0.25 : 0.0);

            WireBoxRenderer.drawBox(matrices, buffer, px - 0.32, baseY, pz - 0.32, px + 0.32, baseY + 0.04, pz + 0.32, r, g, b, 1f);
            WireBoxRenderer.drawBox(matrices, buffer, px - 0.20, baseY + 0.04, pz - 0.20, px + 0.20, baseY + 0.32, pz + 0.20, r, g, b, 1f);
        }

        matrices.popPose();
    }
}
