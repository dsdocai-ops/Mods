package com.omega.client.mixin;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import com.omega.client.presence.OmegaPresence;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/**
 * Prepends an Ω badge (brand red) to the nametag of any player known to be running Omega Client -
 * see OmegaPresence for how players get known. ModifyVariable on the label text at HEAD is the
 * lightest touch: vanilla still does all its own label rendering (background, sneaking dimming,
 * scoreboard scores via PlayerEntityRenderer, which funnels into this super method), we only swap
 * the Text it was going to draw.
 */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
    @ModifyVariable(method = "renderLabelIfPresent", at = @At("HEAD"), argsOnly = true)
    private Text omega$badgeOmegaUsers(Text text, Entity entity) {
        if (!(entity instanceof PlayerEntity player)) return text;
        if (!ModConfig.ACTIVE.showOmegaUsersEnabled) return text;
        if (!OmegaPresence.isOmegaUser(player.getUuid())) return text;
        int badgeRgb = CosmeticCatalog.colorFor(OmegaPresence.cosmeticOf(player.getUuid()));
        return Text.literal("Ω ")
                .setStyle(Style.EMPTY.withColor(badgeRgb))
                .append(text);
    }
}
