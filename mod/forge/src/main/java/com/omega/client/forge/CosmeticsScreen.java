// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import com.omega.client.ModConfig;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Forge-side twin of the Fabric CosmeticsScreen - see that class for what/why (visibility toggles
 * only, gated through OmegaHooks.shouldRenderCosmetic - not equipping, not the nametag badge). Same
 * renames as every other Forge screen here vs. Yarn: Text -> Component, ButtonWidget -> Button,
 * DrawContext -> GuiGraphics, addDrawableChild -> addRenderableWidget, .dimensions(...) -> .bounds(...).
 */
public class CosmeticsScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
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
        int y = 36;

        addToggleRow(startX, y, "All cosmetics", () -> config.cosmeticsMasterEnabled, v -> config.cosmeticsMasterEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "My cosmetics", () -> config.showOwnCosmeticsEnabled, v -> config.showOwnCosmeticsEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Other players' cosmetics", () -> config.showOthersCosmeticsEnabled, v -> config.showOthersCosmeticsEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Hats", () -> config.hatCosmeticsEnabled, v -> config.hatCosmeticsEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Capes", () -> config.capeCosmeticsEnabled, v -> config.capeCosmeticsEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Wings", () -> config.wingsCosmeticsEnabled, v -> config.wingsCosmeticsEnabled = v);
        y += ROW_HEIGHT + 8;

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, y, 100, 20)
                .build());
    }

    private void addToggleRow(int x, int y, String label, BooleanSupplier getter, Consumer<Boolean> setter) {
        ToggleRowSupport.addToggleRow(this::addRenderableWidget, x, y, ROW_WIDTH, label, getter, setter, config::save);
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredString(this.font, "Omega Cosmetics", this.width / 2, 16, 0xFFFFFF);
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
