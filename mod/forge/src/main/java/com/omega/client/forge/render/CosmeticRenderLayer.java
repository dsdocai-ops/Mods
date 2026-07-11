// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.render;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticAnimation;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.CosmeticGeometry;
import com.omega.client.presence.CosmeticTexturedMesh;
import com.omega.client.presence.CosmeticTrail;
import com.omega.client.presence.OmegaPresence;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.resources.ResourceLocation;
import org.joml.Matrix3f;
import org.joml.Matrix4f;
import org.joml.Vector3f;

/**
 * Official-mappings mirror of the Fabric module's CosmeticFeatureRenderer - see that class's doc for
 * the full rendering approach (PROCEDURAL: baked-shade debug-quads geometry from CosmeticGeometry;
 * TEXTURED: a real PNG UV-mapped onto CosmeticTexturedMesh's cloth-like strips, CAPE only - see that
 * class's doc for why not HAT/WINGS; animated per-frame by
 * CosmeticAnimation using this method's own ageInTicks/limbSwingAmount
 * parameters, plus a particle trail for trailColor cosmetics). Duplicated by necessity, same as
 * every Screen/Mixin: RenderLayer vs FeatureRenderer and PoseStack vs MatrixStack are mapping-
 * divergent types that can't cross common/. Registered via EntityRenderersEvent.AddLayers in
 * OmegaClientForge.
 *
 * **renderTextured is this class's least-verified method**, same as its Fabric counterpart: the
 * uv/overlay/light("uv2")/normal VertexConsumer chain, RenderType.entityCutoutNoCull, and
 * OverlayTexture.NO_OVERLAY are Minecraft rendering API this codebase has never touched before this
 * cosmetic, CI-only verified like everything else here (see mod/README.md). If CI reports an
 * unresolved symbol, start with OverlayTexture.NO_OVERLAY (Yarn's equivalent constant may be named
 * DEFAULT_UV instead - see the Fabric class) and the exact uv2()/normal() method names.
 */
public class CosmeticRenderLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
    private static final String TEXTURE_NAMESPACE = "omega_client_forge";

    public CosmeticRenderLayer(RenderLayerParent<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> parent) {
        super(parent);
    }

    @Override
    public void render(PoseStack poseStack, MultiBufferSource buffers, int packedLight, AbstractClientPlayer player,
                       float limbSwing, float limbSwingAmount, float partialTick, float ageInTicks, float netHeadYaw, float headPitch) {
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return;
        if (player.isInvisible() || player.isSpectator()) return;
        CosmeticCatalog.Cosmetic cosmetic = CosmeticCatalog.get(OmegaPresence.cosmeticOf(player.getUUID()));
        if (cosmetic == null) return;

        if (cosmetic.textureId() != null) {
            renderTextured(poseStack, buffers, packedLight, cosmetic, ageInTicks, limbSwingAmount);
        } else if (cosmetic.art() != null) {
            renderProcedural(poseStack, buffers, cosmetic, ageInTicks, limbSwingAmount);
        } else {
            return; // BADGE (or a malformed entry with neither) - nothing to draw here
        }

        if (cosmetic.trailColor() != null) {
            spawnTrail(cosmetic, player, ageInTicks, limbSwingAmount, netHeadYaw);
        }
    }

    private void renderProcedural(PoseStack poseStack, MultiBufferSource buffers,
                                  CosmeticCatalog.Cosmetic cosmetic, float ageTicks, float motion) {
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
            float[] p = CosmeticAnimation.animate(quad, cosmetic.kind(), ageTicks, motion);
            for (int v = 0; v < 4; v++) {
                buffer.vertex(pose, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]).color(r, g, b, 1f).endVertex();
            }
        }
        poseStack.popPose();
    }

    /** See the class doc's prominent note on this method's low-confidence Minecraft texture-rendering API usage. */
    private void renderTextured(PoseStack poseStack, MultiBufferSource buffers, int packedLight,
                                CosmeticCatalog.Cosmetic cosmetic, float ageTicks, float motion) {
        List<CosmeticTexturedMesh.TexturedQuad> quads = CosmeticTexturedMesh.capeStrips(CosmeticTexturedMesh.DEFAULT_CAPE_STRIPS);

        poseStack.pushPose();
        ModelPart anchor = getParentModel().body;
        anchor.translateAndRotate(poseStack);
        Matrix4f pose = poseStack.last().pose();
        Matrix3f normal = poseStack.last().normal();
        ResourceLocation texture = new ResourceLocation(TEXTURE_NAMESPACE, "textures/" + cosmetic.textureId() + ".png");
        VertexConsumer buffer = buffers.getBuffer(RenderType.entityCutoutNoCull(texture));
        for (CosmeticTexturedMesh.TexturedQuad quad : quads) {
            float[] uv = quad.uv();
            float[] n = quad.normal();
            float shade = quad.shade();
            float[] p = quad.positions();
            for (int v = 0; v < 4; v++) {
                float[] animated = CosmeticAnimation.animatePoint(
                        new float[]{ p[v * 3], p[v * 3 + 1], p[v * 3 + 2] }, quad.pivot(), quad.depth01(),
                        cosmetic.kind(), ageTicks, motion);
                buffer.vertex(pose, animated[0], animated[1], animated[2])
                        .color(shade, shade, shade, 1f)
                        .uv(uv[v * 2], uv[v * 2 + 1])
                        .overlay(OverlayTexture.NO_OVERLAY)
                        .uv2(packedLight)
                        .normal(normal, n[0], n[1], n[2])
                        .endVertex();
            }
        }
        poseStack.popPose();
    }

    /** See the class doc's note on this method's lower-confidence Minecraft particle API usage. */
    private void spawnTrail(CosmeticCatalog.Cosmetic cosmetic, AbstractClientPlayer player, float ageTicks, float motion, float yawDegrees) {
        int rgb = cosmetic.trailColor();
        float red = ((rgb >> 16) & 0xFF) / 255f;
        float green = ((rgb >> 8) & 0xFF) / 255f;
        float blue = (rgb & 0xFF) / 255f;
        DustParticleOptions effect = new DustParticleOptions(new Vector3f(red, green, blue), 1.0f);
        for (CosmeticGeometry.TipPoint tip : CosmeticGeometry.tipPointsFor(cosmetic)) {
            if (!CosmeticTrail.shouldEmit(ThreadLocalRandom.current().nextFloat())) continue;
            float[] animated = CosmeticAnimation.animatePoint(tip.position(), tip.pivot(), 1f, cosmetic.kind(), ageTicks, motion);
            float[] world = CosmeticTrail.toWorld(animated, (float) player.getX(), (float) player.getY(), (float) player.getZ(), yawDegrees);
            Minecraft.getInstance().level.addParticle(effect, world[0], world[1], world[2], 0.0, 0.01, 0.0);
        }
    }
}
