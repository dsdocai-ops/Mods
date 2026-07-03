package com.omega.client.features;

import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

/**
 * Keeps the player sprinting while moving forward, instead of requiring double-tap/hold-sprint.
 * Purely a convenience toggle over vanilla's own sprint state - it never changes movement speed,
 * knockback, or anything else combat-relevant beyond what holding sprint normally does. Compiles
 * once here against official mappings, remapped per-platform (see FullbrightFeature's javadoc).
 */
public final class ToggleSprintFeature {
    public void tick(boolean toggleSprintEnabled) {
        if (!toggleSprintEnabled) return;

        Minecraft client = Minecraft.getInstance();
        LocalPlayer player = client.player;
        if (player == null) return;

        boolean movingForward = client.options.keyUp.isDown();
        if (movingForward && !player.isSprinting() && !player.isShiftKeyDown() && player.getFoodData().getFoodLevel() > 6) {
            player.setSprinting(true);
        }
    }
}
