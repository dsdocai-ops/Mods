// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

/**
 * Turns an animated cosmetic tip point (CosmeticGeometry.TipPoint, swayed by
 * CosmeticAnimation.animatePoint) into a world-space particle spawn position - the last step before
 * a renderer hands it to the loader's own particle API. Pure math, zero Minecraft imports: no
 * particle spawning happens here, only the coordinate conversion and the emit/skip decision, so
 * this class is fully unit-testable via plain javac and carries none of the loader-mapping risk the
 * actual addParticle(...) call does (see CosmeticFeatureRenderer/CosmeticRenderLayer for that part).
 *
 * Local model-part space -> world space, using ONLY entity.getX/Y/Z() (guaranteed-stable Entity API
 * across every mapping) and the entity's yaw in degrees (Fabric's headYaw / Forge's netHeadYaw -
 * already-available render() parameters, not a new API call). Deliberately never touches the render
 * MatrixStack/PoseStack (camera-relative, not world-space, without extra camera-position plumbing
 * this codebase doesn't otherwise need) or a body-yaw accessor (a second, less certain mapping name
 * across loaders). Using look/head yaw instead of body yaw is a visible approximation during a fast
 * head-turn - acceptable for a decorative trail, not worth the extra API risk. Standard Minecraft
 * yaw convention: forward = (-sin(yaw), cos(yaw)) in the XZ plane; this class combines that with
 * CosmeticGeometry's own documented local axes (+z = the player's back, y down-positive) to place a
 * local point relative to the wearer.
 *
 * The vertical alignment constant (1.5) is the player model's own neck-to-feet span in this
 * codebase's unit system, not a Minecraft constant: CosmeticGeometry's local y=0 sits at the
 * neck/shoulder line and y=24px=1.5 units at the feet (see the stand-in figure the generate-cosmetic
 * skill's GeometryDump builds with the same box() helper cosmetics extrude through - torso 0..12px,
 * legs 12..24px). Derived from our own frames, cross-checked against the hat frame (whose top ends
 * up a plausible ~0.6 units above the head - see CosmeticTrail's git history / PR description for
 * the full derivation) - not verified against a running game, so treat the exact height as
 * approximate until seen in-game.
 */
public final class CosmeticTrail {
    /** Local y where CosmeticGeometry's frames put the feet (24px / 16), so worldY = entityFeetY + (FEET_LOCAL_Y - localY). */
    private static final float FEET_LOCAL_Y = 1.5f;

    /** Target emission rate at a typical ~60fps render call rate - see shouldEmit(). */
    private static final float EMIT_CHANCE = 0.1f;

    private CosmeticTrail() {
    }

    /** World-space (x,y,z) for a local point, given the wearer's feet position and yaw (degrees). */
    public static float[] toWorld(float[] localPoint, float entityX, float entityY, float entityZ, float yawDegrees) {
        float yaw = (float) Math.toRadians(yawDegrees);
        float cos = (float) Math.cos(yaw);
        float sin = (float) Math.sin(yaw);
        float lx = localPoint[0], ly = localPoint[1], lz = localPoint[2];
        float worldX = entityX + lx * cos + lz * sin;
        float worldY = entityY + (FEET_LOCAL_Y - ly);
        float worldZ = entityZ + lx * sin - lz * cos;
        return new float[]{ worldX, worldY, worldZ };
    }

    /**
     * Whether to spawn a particle this frame, given a caller-supplied random roll in [0,1) - kept as
     * a plain parameter (not an RNG call in here) so this class stays free of both Minecraft and
     * java.util.Random dependencies, and so the emit decision is deterministic/testable given a
     * fixed roll. ~6/sec per tip at a typical 60fps render rate; a denser trail at higher refresh
     * rates isn't compensated for - harmless for a decorative effect.
     */
    public static boolean shouldEmit(float roll) {
        return roll < EMIT_CHANCE;
    }
}
