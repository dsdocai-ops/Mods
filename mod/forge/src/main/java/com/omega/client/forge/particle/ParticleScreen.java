// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge.particle;

import com.omega.client.ModConfig;
import com.omega.client.particle.ParticleScreenSupport;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Forge-side twin of the Fabric ParticleScreen. Renames vs. Yarn: TextFieldWidget -> EditBox,
 * ButtonWidget -> Button, DrawContext -> GuiGraphics, .dimensions(...) -> .bounds(...) (same
 * lowest-confidence guess flagged for ClickGuiScreen/SchematicScreen), Screen.textRenderer ->
 * Screen.font.
 */
public class ParticleScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;
    private static final int MAX_VISIBLE_BLACKLIST_ROWS = 5;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - closing to nothing made every sub-screen exit feel like a dead end. */
    private final Screen parent;
    private EditBox blacklistField;
    private String statusMessage = "";

    public ParticleScreen(ModConfig config, Screen parent) {
        super(Component.literal("Omega Particles"));
        this.config = config;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 36;

        addToggleRow(startX, y, "All particles", () -> config.particlesMasterEnabled, v -> config.particlesMasterEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Block particles", () -> config.blockParticlesEnabled, v -> config.blockParticlesEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Ambient block particles", () -> config.ambientParticlesEnabled, v -> config.ambientParticlesEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Totem particles", () -> config.totemParticlesEnabled, v -> config.totemParticlesEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Crit particles", () -> config.critParticlesEnabled, v -> config.critParticlesEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Explosion particles", () -> config.explosionParticlesEnabled, v -> config.explosionParticlesEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Portal particles", () -> config.portalParticlesEnabled, v -> config.portalParticlesEnabled = v);
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(densityText(), b -> {
                    config.particleDensity = ParticleScreenSupport.nextDensityStep(config.particleDensity);
                    b.setMessage(densityText());
                    config.save();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        // init() reruns on window resize (and via the clearWidgets()+init() refresh pattern),
        // rebuilding every widget - carry the half-typed id across instead of silently wiping it.
        String previousText = blacklistField != null ? blacklistField.getValue() : "";
        blacklistField = new EditBox(this.font, startX, y, 150, 20, Component.literal("Particle id, e.g. minecraft:soul"));
        blacklistField.setMaxLength(64);
        blacklistField.setValue(previousText);
        this.addRenderableWidget(blacklistField);
        this.addRenderableWidget(Button.builder(Component.literal("Add"), b -> addBlacklistEntry())
                .bounds(startX + 156, y, ROW_WIDTH - 156, 20)
                .build());
        y += ROW_HEIGHT + 4;

        y = addBlacklistRows(startX, y);

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, Math.max(y + 12, this.height - 30), 100, 20)
                .build());
    }

    private int addBlacklistRows(int startX, int y) {
        List<String> blacklist = config.particleBlacklist;
        int shown = Math.min(blacklist.size(), MAX_VISIBLE_BLACKLIST_ROWS);
        for (int i = 0; i < shown; i++) {
            String id = blacklist.get(i);
            this.addRenderableWidget(Button.builder(Component.literal(id), b -> {})
                    .bounds(startX, y, 150, 20)
                    .build());
            this.addRenderableWidget(Button.builder(Component.literal("Remove"), b -> removeBlacklistEntry(id))
                    .bounds(startX + 156, y, ROW_WIDTH - 156, 20)
                    .build());
            y += ROW_HEIGHT;
        }
        if (blacklist.size() > MAX_VISIBLE_BLACKLIST_ROWS) {
            statusMessage = (blacklist.size() - MAX_VISIBLE_BLACKLIST_ROWS) + " more blacklisted ids not shown.";
        }
        return y;
    }

    private void addBlacklistEntry() {
        String raw = blacklistField.getValue().trim();
        if (raw.isEmpty()) return;
        String id = ParticleScreenSupport.normalizeNamespacedId(raw);
        if (!config.particleBlacklist.contains(id)) {
            config.particleBlacklist.add(id);
            config.save();
        }
        blacklistField.setValue("");
        statusMessage = "";
        this.clearWidgets();
        this.init();
    }

    private void removeBlacklistEntry(String id) {
        config.particleBlacklist.remove(id);
        config.save();
        this.clearWidgets();
        this.init();
    }

    private Component densityText() {
        return Component.literal("Density: " + Math.round(config.particleDensity * 100) + "%");
    }

    private void addToggleRow(int x, int y, String label, BooleanSupplier getter, Consumer<Boolean> setter) {
        Button button = Button.builder(rowText(label, getter.getAsBoolean()), b -> {
            boolean next = !getter.getAsBoolean();
            setter.accept(next);
            b.setMessage(rowText(label, next));
            config.save();
        }).bounds(x, y, ROW_WIDTH, 20).build();
        this.addRenderableWidget(button);
    }

    private static Component rowText(String label, boolean enabled) {
        return Component.literal(label + ": " + (enabled ? "ON" : "OFF"));
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredString(this.font, "Omega Particles", centerX, 16, 0xFFFFFF);
        if (!statusMessage.isEmpty()) {
            context.drawCenteredString(this.font, statusMessage, centerX, this.height - 44, 0xFFD37F);
        }
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
