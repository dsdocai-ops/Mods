// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.omega.client.presence.CosmeticCatalog;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Lets the player pick which cosmetic badge (if any) shows up next to their nametag for other Omega
 * Client players - see CosmeticCatalog for the id/label/color list and ModConfig.ownedCosmeticId for
 * where the choice is stored. Same click-to-cycle-value pattern as VisualScreen's highlight color
 * button, just a single row since there's only one thing to pick here.
 */
public class CosmeticsScreen extends Screen {
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
        int y = 40;

        this.addDrawableChild(ButtonWidget.builder(cosmeticText(), b -> {
                    config.ownedCosmeticId = CosmeticCatalog.nextCosmeticId(config.ownedCosmeticId);
                    b.setMessage(cosmeticText());
                    config.save();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += 32;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, y, 100, 20)
                .build());
    }

    private Text cosmeticText() {
        return Text.literal("Badge: " + CosmeticCatalog.labelFor(config.ownedCosmeticId));
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Cosmetics", centerX, 16, 0xFFFFFF);
        context.drawCenteredTextWithShadow(this.textRenderer, "Click to cycle - shown next to your name to other Omega users", centerX, 27, 0xAAAAAA);
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
