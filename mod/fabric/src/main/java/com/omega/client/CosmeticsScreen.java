// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Cosmetic *visibility* toggles - a master switch, a self/others split, and one toggle per cosmetic
 * slot (hat/cape/wings). This is deliberately separate from the Ω name badge toggle on the main
 * menu (showOmegaUsersEnabled) and from equipping a cosmetic (done in the launcher's Cosmetics
 * page) - it only controls what CosmeticRenderer draws. Same master+per-category shape and
 * on/off-button-per-ModConfig-field pattern as ParticleScreen.
 */
public class CosmeticsScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;

    public CosmeticsScreen(ModConfig config, Screen parent) {
        super(Text.literal("Omega Cosmetics"));
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

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, y, 100, 20)
                .build());
    }

    private void addToggleRow(int x, int y, String label, BooleanSupplier getter, Consumer<Boolean> setter) {
        ToggleRowSupport.addToggleRow(this::addDrawableChild, x, y, ROW_WIDTH, label, getter, setter, config::save);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Cosmetics", this.width / 2, 16, 0xFFFFFF);
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
