// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * The Info HUD's per-element sub-toggles (coords/FPS/ping/direction/CPS/keystrokes) - split out of
 * ClickGuiScreen because that screen was already at its two-column row budget. The master
 * "Info HUD" switch stays on the main ClickGui; this only controls what shows once that's on.
 * Same on/off-button-per-ModConfig-field pattern as every other screen here (see ParticleScreen).
 */
public class HudScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;

    public HudScreen(ModConfig config, Screen parent) {
        super(Text.literal("Omega HUD"));
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

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, y, 100, 20)
                .build());
    }

    private void addToggleRow(int x, int y, String label, BooleanSupplier getter, Consumer<Boolean> setter) {
        ButtonWidget button = ButtonWidget.builder(rowText(label, getter.getAsBoolean()), b -> {
            boolean next = !getter.getAsBoolean();
            setter.accept(next);
            b.setMessage(rowText(label, next));
            config.save();
        }).dimensions(x, y, ROW_WIDTH, 20).build();
        this.addDrawableChild(button);
    }

    private static Text rowText(String label, boolean enabled) {
        return Text.literal(label + ": " + (enabled ? "ON" : "OFF"));
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega HUD", this.width / 2, 16, 0xFFFFFF);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    @Override
    public void close() {
        config.save();
        if (this.client != null) this.client.setScreen(parent);
    }
}
