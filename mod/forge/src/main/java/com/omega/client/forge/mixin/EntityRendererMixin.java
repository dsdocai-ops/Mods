package com.omega.client.forge.mixin;

import com.omega.client.ModConfig;
import com.omega.client.presence.OmegaPresence;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.network.chat.Style;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/**
 * Forge-side twin of the Fabric EntityRendererMixin - prepends an Omega badge to nametags of
 * players known to be on Omega Client. Official-mappings target: renderNameTag (Yarn's
 * renderLabelIfPresent); Text -> Component, Style.withColor(int) shape assumed identical.
 */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
    private static final int OMEGA_BADGE_RGB = 0xE63946;

    @ModifyVariable(method = "renderNameTag", at = @At("HEAD"), argsOnly = true)
    private Component omega$badgeOmegaUsers(Component text, Entity entity) {
        if (!(entity instanceof Player player)) return text;
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return text;
        if (!OmegaPresence.isOmegaUser(player.getUUID())) return text;
        MutableComponent badge = Component.literal("Ω ").setStyle(Style.EMPTY.withColor(OMEGA_BADGE_RGB));
        return badge.append(text);
    }
}
