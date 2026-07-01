package com.forgepvp.client.features;

import com.forgepvp.client.ModConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;

/**
 * Keeps the player sprinting while moving forward, instead of requiring double-tap/hold-sprint.
 * Purely a convenience toggle over vanilla's own sprint state - it never changes movement speed,
 * knockback, or anything else combat-relevant beyond what holding sprint normally does.
 */
public final class ToggleSprintFeature {
    public void tick(ModConfig config) {
        if (!config.toggleSprintEnabled) return;

        MinecraftClient client = MinecraftClient.getInstance();
        ClientPlayerEntity player = client.player;
        if (player == null) return;

        boolean movingForward = client.options.forwardKey.isPressed();
        if (movingForward && !player.isSneaking() && player.getHungerManager().getFoodLevel() > 6) {
            player.setSprinting(true);
        }
    }
}
