// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.render;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.CosmeticGeometry;
import com.omega.client.presence.OmegaPresence;
import java.util.List;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.math.MatrixStack;
import org.joml.Matrix4f;

/**
 * Draws gear cosmetics (hat/cape/wings - see CosmeticCatalog.Kind) on players known to be running
 * Omega Client: each cosmetic's pixel art (CosmeticPixelArt), extruded by CosmeticGeometry into
 * per-pixel colored quads the way vanilla extrudes item textures. Registered through Fabric API's
 * LivingEntityFeatureRendererRegistrationCallback (see OmegaClient) - a documented API, keeping
 * this consistent with the project's zero-Mixin-unless-impossible rule; the nametag badge kind
 * stays in EntityRendererMixin, which genuinely needed one.
 *
 * Rendering uses RenderLayer.getDebugQuads() (position+color, depth-tested): no texture, no
 * lighting - shade is baked into each quad by CosmeticGeometry, so cosmetics read the same in a
 * cave as in daylight (an accepted, fullbright-adjacent aesthetic for v1, not a bug). Anchoring to
 * the head/body ModelPart means sneaking, swimming, and head-turn poses carry the gear along;
 * there's no flap/sway animation of its own yet.
 */
public class CosmeticFeatureRenderer extends FeatureRenderer<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> {
    public CosmeticFeatureRenderer(FeatureRendererContext<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> context) {
        super(context);
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light, AbstractClientPlayerEntity player,
                       float limbAngle, float limbDistance, float tickDelta, float animationProgress, float headYaw, float headPitch) {
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return;
        if (player.isInvisible() || player.isSpectator()) return;
        CosmeticCatalog.Cosmetic cosmetic = CosmeticCatalog.get(OmegaPresence.cosmeticOf(player.getUuid()));
        List<CosmeticGeometry.Quad> quads = CosmeticGeometry.quadsFor(cosmetic);
        if (quads.isEmpty()) return;

        matrices.push();
        ModelPart anchor = cosmetic.kind() == CosmeticCatalog.Kind.HAT ? getContextModel().head : getContextModel().body;
        anchor.rotate(matrices);
        Matrix4f matrix = matrices.peek().getPositionMatrix();
        VertexConsumer buffer = vertexConsumers.getBuffer(RenderLayer.getDebugQuads());
        for (CosmeticGeometry.Quad quad : quads) {
            int rgb = quad.rgb();
            float r = ((rgb >> 16) & 0xFF) / 255f * quad.shade();
            float g = ((rgb >> 8) & 0xFF) / 255f * quad.shade();
            float b = (rgb & 0xFF) / 255f * quad.shade();
            float[] p = quad.positions();
            for (int v = 0; v < 4; v++) {
                buffer.vertex(matrix, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).color(r, g, b, 1f).next();
            }
        }
        matrices.pop();
    }
}
