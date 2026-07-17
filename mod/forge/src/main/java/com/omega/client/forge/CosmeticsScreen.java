// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import com.omega.client.ModConfig;
import com.omega.client.presence.CosmeticCatalog;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Forge-side twin of the Fabric CosmeticsScreen. Same class renames as the rest of this module's
 * Forge screens (Text -> Component, ButtonWidget -> Button, DrawContext -> GuiGraphics,
 * Screen.client -> Screen.minecraft, Screen.textRenderer -> Screen.font, addDrawableChild ->
 * addRenderableWidget, ButtonWidget.dimensions(...) -> Button.bounds(...)) - see the Fabric side's
 * CosmeticsScreen for the full rationale and ClickGuiScreen's javadoc for the rename list itself.
 */
public class CosmeticsScreen extends Screen {
    private static final int ROW_WIDTH = 220;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;

    public CosmeticsScreen(ModConfig config, Screen parent) {
        super(Component.literal("Omega Cosmetics"));
        this.config = config;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 40;

        this.addRenderableWidget(Button.builder(cosmeticText(), b -> {
                    config.ownedCosmeticId = CosmeticCatalog.nextCosmeticId(config.ownedCosmeticId);
                    b.setMessage(cosmeticText());
                    config.save();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += 32;

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, y, 100, 20)
                .build());
    }

    private Component cosmeticText() {
        return Component.literal("Badge: " + CosmeticCatalog.labelFor(config.ownedCosmeticId));
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredString(this.font, "Omega Cosmetics", centerX, 16, 0xFFFFFF);
        context.drawCenteredString(this.font, "Click to cycle - shown next to your name to other Omega users", centerX, 27, 0xAAAAAA);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        config.save();
        if (this.minecraft != null) this.minecraft.setScreen(parent);
    }
}
