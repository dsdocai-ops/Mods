// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.render;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.CosmeticGeometry;
import com.omega.client.presence.OmegaPresence;
import java.util.List;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import org.joml.Matrix4f;

/**
 * Official-mappings mirror of the Fabric module's CosmeticFeatureRenderer (see that class's doc for
 * the rendering approach - baked-shade debug-quads geometry from CosmeticGeometry, anchored to the
 * head/body model part). Duplicated by necessity, same as every Screen/Mixin: FeatureRenderer vs
 * RenderLayer and MatrixStack vs PoseStack are mapping-divergent types that can't cross common/.
 * Registered via EntityRenderersEvent.AddLayers in OmegaClientForge.
 */
public class CosmeticRenderLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
    public CosmeticRenderLayer(RenderLayerParent<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> parent) {
        super(parent);
    }

    @Override
    public void render(PoseStack poseStack, MultiBufferSource buffers, int packedLight, AbstractClientPlayer player,
                       float limbSwing, float limbSwingAmount, float partialTick, float ageInTicks, float netHeadYaw, float headPitch) {
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return;
        if (player.isInvisible() || player.isSpectator()) return;
        CosmeticCatalog.Cosmetic cosmetic = CosmeticCatalog.get(OmegaPresence.cosmeticOf(player.getUUID()));
        List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(cosmetic);
        if (quads.isEmpty()) return;

        poseStack.pushPose();
        ModelPart anchor = cosmetic.kind() == CosmeticCatalog.Kind.HAT ? getParentModel().head : getParentModel().body;
        anchor.translateAndRotate(poseStack);
        Matrix4f pose = poseStack.last().pose();
        VertexConsumer buffer = buffers.getBuffer(RenderType.debugQuads());
        for (CosmeticGeometry.Quad quad : quads) {
            int rgb = quad.rgb();
            float r = ((rgb >> 16) & 0xFF) / 255f * quad.shade();
            float g = ((rgb >> 8) & 0xFF) / 255f * quad.shade();
            float b = (rgb & 0xFF) / 255f * quad.shade();
            float[] p = quad.positions();
            for (int v = 0; v < 4; v++) {
                buffer.vertex(pose, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).color(r, g, b, 1f).endVertex();
            }
        }
        poseStack.popPose();
    }
}
