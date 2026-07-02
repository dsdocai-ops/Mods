package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

/**
 * Forge-side twin of the Fabric ToggleSprintFeature. Several official-mappings names used here
 * (keyUp for the forward keybind, isShiftKeyDown for sneaking, getFoodData for the hunger manager)
 * are commonly-cited examples of names that differ from Yarn's more descriptive equivalents
 * (forwardKey / isSneaking / getHungerManager) - moderate confidence, flagged in mod/README.md.
 */
public final class ToggleSprintFeature {
    public void tick(ModConfig config) {
        if (!config.toggleSprintEnabled) return;

        Minecraft client = Minecraft.getInstance();
        LocalPlayer player = client.player;
        if (player == null) return;

        boolean movingForward = client.options.keyUp.isDown();
        if (movingForward && !player.isSprinting() && !player.isShiftKeyDown() && player.getFoodData().getFoodLevel() > 6) {
            player.setSprinting(true);
        }
    }
}
