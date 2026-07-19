// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.render;

import com.omega.client.platform.OmegaHooks;
import com.omega.client.presence.CosmeticAnimation;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.CosmeticGeometry;
import com.omega.client.presence.CosmeticTexturedMesh;
import com.omega.client.presence.CosmeticTrail;
import com.omega.client.presence.OmegaPresence;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.Identifier;
import org.joml.Matrix3f;
import org.joml.Matrix4f;
import org.joml.Vector3f;

/**
 * Draws gear cosmetics (hat/cape/wings - see CosmeticCatalog.Kind) on players known to be running
 * Omega Client, gated per-kind and per-self/others by OmegaHooks.shouldRenderCosmetic (the in-game
 * Cosmetics... screen's toggles - deliberately independent of the nametag Ω badge), one of two ways
 * depending on the cosmetic (see CosmeticCatalog.Cosmetic's doc):
 *
 * PROCEDURAL (renderProcedural, cosmetic.art() != null) - pixel art extruded by CosmeticGeometry
 * into per-pixel colored quads the way vanilla extrudes item textures, drawn with
 * RenderLayer.getDebugQuads() (position+color, depth-tested, no texture/lighting - shade is baked
 * into each quad by CosmeticGeometry, so cosmetics read the same in a cave as in daylight; an
 * accepted, fullbright-adjacent aesthetic, not a bug).
 *
 * TEXTURED (renderTextured, cosmetic.textureId() != null, CAPE only - see
 * CosmeticTexturedMesh's class doc for why not HAT/WINGS) - a real PNG UV-mapped onto cloth-like
 * strips from CosmeticTexturedMesh, drawn with
 * RenderLayer.getEntityCutoutNoCull (an actual textured+lit vertex format: texture UV, overlay,
 * packed light, and a normal - unlike
 * the procedural path above, Minecraft's own diffuse lighting participates here, on top of this
 * class's own baked shade multiplier for stylistic consistency with the procedural cosmetics).
 * **This whole method is the least-verified code in this class**: RenderLayer.getEntityCutoutNoCull,
 * the texture/overlay/light/normal VertexConsumer chain, and OverlayTexture.DEFAULT_UV are all
 * Minecraft rendering API this codebase has never touched before this cosmetic, and - like
 * everything else that imports net.minecraft.* here - cannot be compiled or run outside CI (see
 * mod/README.md). If CI reports an unresolved symbol in renderTextured, start with
 * OverlayTexture.DEFAULT_UV (the single most uncertain name in this file - some mapping sets may
 * call it NO_OVERLAY instead) and RenderLayer.getEntityCutoutNoCull's exact name before anything else.
 *
 * Both paths are registered through Fabric API's LivingEntityFeatureRendererRegistrationCallback
 * (see OmegaClient) - a documented API, keeping this consistent with the project's zero-Mixin-
 * unless-impossible rule; the nametag badge kind stays in EntityRendererMixin, which genuinely
 * needed one. Anchoring to the head/body ModelPart means sneaking, swimming, and head-turn poses
 * carry the gear along. CAPE/WINGS quads also get a per-frame sway/flap from CosmeticAnimation,
 * driven by this method's own animationProgress/limbDistance parameters - see that class's doc.
 *
 * Cosmetics with a non-null trailColor also spawn a sparse colored dust trail from
 * CosmeticGeometry's tip points (cape hem, wingtips) - see spawnTrail below, works identically for
 * both procedural and textured cosmetics. That part touches Minecraft particle APIs
 * (DustParticleEffect, ClientWorld#addParticle) - also CI-only verified, though the world-placement
 * math it feeds from is pure and numerically sanity-checked (see CosmeticTrail's doc).
 */
public class CosmeticFeatureRenderer extends FeatureRenderer<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> {
    private static final String TEXTURE_NAMESPACE = "omega-client";

    public CosmeticFeatureRenderer(FeatureRendererContext<AbstractClientPlayerEntity, PlayerEntityModel<AbstractClientPlayerEntity>> context) {
        super(context);
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light, AbstractClientPlayerEntity player,
                       float limbAngle, float limbDistance, float tickDelta, float animationProgress, float headYaw, float headPitch) {
        if (player.isInvisible() || player.isSpectator()) return;
        CosmeticCatalog.Cosmetic cosmetic = CosmeticCatalog.get(OmegaPresence.cosmeticOf(player.getUuid()));
        if (cosmetic == null) return;
        boolean isSelf = player == MinecraftClient.getInstance().player;
        if (!OmegaHooks.shouldRenderCosmetic(isSelf, cosmetic.kind())) return;

        if (cosmetic.textureId() != null) {
            renderTextured(matrices, vertexConsumers, light, cosmetic, animationProgress, limbDistance);
        } else if (cosmetic.art() != null) {
            renderProcedural(matrices, vertexConsumers, cosmetic, animationProgress, limbDistance);
        } else {
            return; // BADGE (or a malformed entry with neither) - nothing to draw here
        }

        if (cosmetic.trailColor() != null) {
            spawnTrail(cosmetic, player, animationProgress, limbDistance, headYaw);
        }
    }

    private void renderProcedural(MatrixStack matrices, VertexConsumerProvider vertexConsumers,
                                  CosmeticCatalog.Cosmetic cosmetic, float ageTicks, float motion) {
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
            float[] p = CosmeticAnimation.animate(quad, cosmetic.kind(), ageTicks, motion);
            for (int v = 0; v < 4; v++) {
                buffer.vertex(matrix, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).color(r, g, b, 1f).next();
            }
        }
        matrices.pop();
    }

    /** See the class doc's prominent note on this method's low-confidence Minecraft texture-rendering API usage. */
    private void renderTextured(MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light,
                                CosmeticCatalog.Cosmetic cosmetic, float ageTicks, float motion) {
        List<CosmeticTexturedMesh.TexturedQuad> quads = CosmeticTexturedMesh.capeStrips(CosmeticTexturedMesh.DEFAULT_CAPE_STRIPS);

        matrices.push();
        ModelPart anchor = getContextModel().body;
        anchor.rotate(matrices);
        Matrix4f matrix = matrices.peek().getPositionMatrix();
        Matrix3f normalMatrix = matrices.peek().getNormalMatrix();
        Identifier texture = new Identifier(TEXTURE_NAMESPACE, "textures/" + cosmetic.textureId() + ".png");
        VertexConsumer buffer = vertexConsumers.getBuffer(RenderLayer.getEntityCutoutNoCull(texture));
        for (CosmeticTexturedMesh.TexturedQuad quad : quads) {
            float[] uv = quad.uv();
            float[] n = quad.normal();
            float shade = quad.shade();
            float[] p = quad.positions();
            for (int v = 0; v < 4; v++) {
                float[] animated = CosmeticAnimation.animatePoint(
                        new float[]{ p[v * 3], p[v * 3 + 1], p[v * 3 + 2] }, quad.pivot(), quad.depth01(),
                        cosmetic.kind(), ageTicks, motion);
                buffer.vertex(matrix, animated[0], animated[1], animated[2])
                        .color(shade, shade, shade, 1f)
                        .texture(uv[v * 2], uv[v * 2 + 1])
                        .overlay(OverlayTexture.DEFAULT_UV)
                        .light(light)
                        .normal(normalMatrix, n[0], n[1], n[2])
                        .next();
            }
        }
        matrices.pop();
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
