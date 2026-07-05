// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.mixin;

import com.omega.client.OmegaClient;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Adds a small Ω button to the top-right corner of the vanilla pause menu (Esc) that opens the
 * same menu the "key.omega-client.menu" keybind does (default Right Shift, rebindable like any
 * other keybind in vanilla's Controls screen under "Omega Client") - a second, always-visible way
 * in for anyone who hasn't found/rebound the key yet.
 *
 * Injects into initWidgets() (extracted from init() specifically for this kind of thing, a
 * well-established hook point for adding pause-menu buttons) rather than duplicating any of
 * vanilla's own button layout math - this runs after that layout is already built, and reruns
 * cleanly on window resize the same way (initWidgets() re-fires from a cleared widget list each
 * time, so this never stacks duplicate buttons).
 *
 * Mixin classes that need to call inherited protected members (addDrawableChild, width, height)
 * must restate the real target's superclass - GameMenuScreen really does extend Screen, so this
 * isn't a workaround, it's just modeling the actual hierarchy for the annotation processor.
 */
@Mixin(GameMenuScreen.class)
public abstract class GameMenuScreenMixin extends Screen {
    protected GameMenuScreenMixin(Text title) {
        super(title);
    }

    @Inject(method = "initWidgets", at = @At("TAIL"))
    private void omega$addMenuButton(CallbackInfo ci) {
        this.addDrawableChild(ButtonWidget.builder(Text.literal("Ω"), b -> {
                    if (OmegaClient.INSTANCE != null) {
                        OmegaClient.INSTANCE.openMenu(MinecraftClient.getInstance());
                    }
                })
                .dimensions(this.width - 26, 6, 20, 20)
                .build());
    }
}
