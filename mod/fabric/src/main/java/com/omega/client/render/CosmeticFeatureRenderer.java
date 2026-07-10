// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.render;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticAnimation;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.CosmeticGeometry;
import com.omega.client.presence.CosmeticTrail;
import com.omega.client.presence.OmegaPresence;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.particle.DustParticleEffect;
import org.joml.Matrix4f;
import org.joml.Vector3f;

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
 * the head/body ModelPart means sneaking, swimming, and head-turn poses carry the gear along.
 * CAPE/WINGS quads also get a per-frame sway/flap from CosmeticAnimation, driven by this method's
 * own animationProgress/limbDistance parameters - see that class's doc.
 *
 * Cosmetics with a non-null trailColor (CosmeticCatalog.Cosmetic) also spawn a sparse colored dust
 * trail from CosmeticGeometry's tip points (cape hem, wingtips) - see spawnTrail below. That part,
 * unlike the mesh rendering above, touches Minecraft particle APIs used nowhere else in this file
 * (DustParticleEffect, ClientWorld#addParticle) - lower confidence than the rest of this class, same
 * caveat this project already gives Forge's more novel event wiring (see mod/README.md); the world-
 * placement math it feeds from is pure and numerically sanity-checked (see CosmeticTrail's doc), but
 * the actual spawn call is CI-only verified like everything else that touches Minecraft here.
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
            float[] p = CosmeticAnimation.animate(quad, cosmetic.kind(), animationProgress, limbDistance);
            for (int v = 0; v < 4; v++) {
                buffer.vertex(matrix, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).color(r, g, b, 1f).next();
            }
        }
        matrices.pop();

        if (cosmetic.trailColor() != null) {
            spawnTrail(cosmetic, player, animationProgress, limbDistance, headYaw);
        }
    }

    /** See the class doc's note on this method's lower-confidence Minecraft particle API usage. */
    private void spawnTrail(CosmeticCatalog.Cosmetic cosmetic, AbstractClientPlayerEntity player, float ageTicks, float motion, float yawDegrees) {
        int rgb = cosmetic.trailColor();
        float red = ((rgb >> 16) & 0xFF) / 255f;
        float green = ((rgb >> 8) & 0xFF) / 255f;
        float blue = (rgb & 0xFF) / 255f;
        DustParticleEffect effect = new DustParticleEffect(new Vector3f(red, green, blue), 1.0f);
        for (CosmeticGeometry.TipPoint tip : CosmeticGeometry.tipPointsFor(cosmetic)) {
            if (!CosmeticTrail.shouldEmit(ThreadLocalRandom.current().nextFloat())) continue;
            float[] animated = CosmeticAnimation.animatePoint(tip.position(), tip.pivot(), 1f, cosmetic.kind(), ageTicks, motion);
            float[] world = CosmeticTrail.toWorld(animated, (float) player.getX(), (float) player.getY(), (float) player.getZ(), yawDegrees);
            MinecraftClient.getInstance().world.addParticle(effect, world[0], world[1], world[2], 0.0, 0.01, 0.0);
        }
    }
}
