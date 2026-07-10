// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

/**
 * Procedural sway/flap for CAPE and WINGS cosmetics - a stylized per-vertex rotation about each
 * quad's pivot (CosmeticGeometry.Quad.pivot), scaled by how far that quad sits from the rigid
 * anchor edge (Quad.depth01: 0 at the collar/shoulder, 1 at the free hem/wingtip). Not a physics or
 * cloth simulation - no wind, no collision, no per-cosmetic tuning beyond kind - proportionate to a
 * vanity cosmetic, same spirit as CosmeticGeometry's flat baked shading. Zero Minecraft imports,
 * called fresh every frame by both loaders' renderers: animation is intentionally never baked into
 * CosmeticGeometry's cached quad lists, since those are shared by every wearer of a cosmetic while
 * animation state (time, this player's motion) is per-frame and per-player.
 *
 * Both loaders already receive exactly the two inputs this needs as standard FeatureRenderer /
 * RenderLayer parameters - no new plumbing, no velocity-vector access (a Fabric/Forge mapping-
 * divergent API this class deliberately avoids touching):
 *   - ageTicks: Fabric's "animationProgress" / Forge's "ageInTicks" - entity age + partial tick,
 *     monotonic and smooth across frames, safe to feed straight into sin().
 *   - motion: Fabric's "limbDistance" / Forge's "limbSwingAmount" - vanilla's own limb-swing-amount
 *     parameter, already ~0 standing still and >1 sprinting; clamped to [0,1] here as an "activity"
 *     scalar. Reusing it means zero extra per-frame computation in the renderers.
 */
public final class CosmeticAnimation {
    private CosmeticAnimation() {
    }

    /** Returns quad's positions, swayed/flapped for this frame; the same array (no copy) for a rigid quad (depth01 <= 0) or a BADGE/HAT kind. */
    public static float[] animate(CosmeticGeometry.Quad quad, CosmeticCatalog.Kind kind, float ageTicks, float motion) {
        float depth = quad.depth01();
        if (depth <= 0f || (kind != CosmeticCatalog.Kind.CAPE && kind != CosmeticCatalog.Kind.WINGS)) {
            return quad.positions();
        }
        float m = Math.max(0f, Math.min(1f, motion));

        float pitchDeg;
        float rollDeg = 0f;
        if (kind == CosmeticCatalog.Kind.CAPE) {
            // Idle: a slow breathing sway, always present. Moving: a forward lean (cape trailing
            // behind) plus a faster wag riding on top, both fading in with m. A slow, out-of-phase
            // roll keeps the motion from reading as a perfect back-and-forth metronome.
            pitchDeg = depth * (6f * wave(ageTicks, 0.06f, 0f) + m * (14f + 8f * wave(ageTicks, 0.35f, 0f)));
            rollDeg = depth * 3f * wave(ageTicks, 0.03f, 1.7f);
        } else {
            // Flap: amplitude and frequency both climb with motion, idle-to-sprint, like picking up
            // wingbeat rate when running or jumping.
            pitchDeg = depth * (10f + m * 18f) * wave(ageTicks, 0.5f + m * 0.35f, 0f);
        }

        float[] p = quad.positions();
        float[] pivot = quad.pivot();
        float[] out = new float[12];
        for (int i = 0; i < 4; i++) {
            float[] rotated = rotate(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], pivot,
                    (float) Math.toRadians(pitchDeg), (float) Math.toRadians(rollDeg));
            out[i * 3] = rotated[0];
            out[i * 3 + 1] = rotated[1];
            out[i * 3 + 2] = rotated[2];
        }
        return out;
    }

    private static float wave(float ageTicks, float freq, float phase) {
        return (float) Math.sin(ageTicks * freq + phase);
    }

    /** Rotates a point around pivot: pitchRad about local X, then (if nonzero) rollRad about local Z. */
    private static float[] rotate(float x, float y, float z, float[] pivot, float pitchRad, float rollRad) {
        float[] afterPitch = rotateAroundAxis(x, y, z, pivot, 1f, 0f, 0f, pitchRad);
        return rollRad == 0f ? afterPitch : rotateAroundAxis(afterPitch[0], afterPitch[1], afterPitch[2], pivot, 0f, 0f, 1f, rollRad);
    }

    /**
     * Rodrigues' rotation formula around a unit axis through pivot - hand-rolled, matching this
     * codebase's existing style (CosmeticGeometry.shadeOf already hand-rolls a cross product rather
     * than pull in a matrix/vector library for one use).
     */
    private static float[] rotateAroundAxis(float x, float y, float z, float[] pivot, float ax, float ay, float az, float angle) {
        float px = x - pivot[0], py = y - pivot[1], pz = z - pivot[2];
        float cos = (float) Math.cos(angle), sin = (float) Math.sin(angle);
        float dot = px * ax + py * ay + pz * az;
        float cx = ay * pz - az * py, cy = az * px - ax * pz, cz = ax * py - ay * px;
        float rx = px * cos + cx * sin + ax * dot * (1 - cos);
        float ry = py * cos + cy * sin + ay * dot * (1 - cos);
        float rz = pz * cos + cz * sin + az * dot * (1 - cos);
        return new float[]{ rx + pivot[0], ry + pivot[1], rz + pivot[2] };
    }
}
