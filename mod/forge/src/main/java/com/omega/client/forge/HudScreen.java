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
 * Forge-side twin of the Fabric HudScreen - see that class for what/why. Same renames as every
 * other Forge screen here vs. Yarn: Text -> Component, ButtonWidget -> Button, DrawContext ->
 * GuiGraphics, addDrawableChild -> addRenderableWidget, .dimensions(...) -> .bounds(...).
 */
public class HudScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;

    public HudScreen(ModConfig config, Screen parent) {
        super(Component.literal("Omega HUD"));
        this.config = config;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 36;

        addToggleRow(startX, y, "Show coordinates", () -> config.hudShowCoords, v -> config.hudShowCoords = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Show FPS", () -> config.hudShowFps, v -> config.hudShowFps = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Show ping", () -> config.hudShowPing, v -> config.hudShowPing = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Show facing direction", () -> config.hudShowDirection, v -> config.hudShowDirection = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Show CPS", () -> config.hudShowCps, v -> config.hudShowCps = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Show keystrokes", () -> config.hudShowKeystrokes, v -> config.hudShowKeystrokes = v);
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
        context.drawCenteredString(this.font, "Omega HUD", this.width / 2, 16, 0xFFFFFF);
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
