// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.mixin;

import com.omega.client.forge.OmegaClientForge;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Forge-side twin of the Fabric GameMenuScreenMixin - see that class for what/why. Injects into
 * init() rather than a separate "initWidgets"-style extracted method: unlike Yarn's GameMenuScreen,
 * there's no confirmed official-mappings equivalent extracted method to target here, and every
 * Screen subclass necessarily overrides init() to build its own widgets, so it's the more certain
 * hook - lower-confidence than most of this module's other Mixins only in the sense that it's a
 * fresh guess rather than reusing an already-proven-in-CI name; see mod/README.md.
 */
@Mixin(PauseScreen.class)
public abstract class PauseScreenMixin extends Screen {
    protected PauseScreenMixin(Component title) {
        super(title);
    }

    @Inject(method = "init", at = @At("TAIL"))
    private void omega$addMenuButton(CallbackInfo ci) {
        this.addRenderableWidget(Button.builder(Component.literal("Ω"), b -> {
                    if (OmegaClientForge.INSTANCE != null) {
                        OmegaClientForge.INSTANCE.openMenu(Minecraft.getInstance());
                    }
                })
                .bounds(this.width - 26, 6, 20, 20)
                .build());
    }
}
