// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.particle;

import com.omega.client.ModConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Particle-control settings: a master switch, one toggle per particle category (block, ambient,
 * totem, crit, explosion, portal), a density slider for thinning whatever's left, and a free-form
 * blacklist for anything the categories don't cover - "and more" from the feature request. See
 * ParticleFilter for how these are applied, and mod/README.md's "Particle control" section for how
 * this actually reaches into the game (the mod's one deliberate Mixin).
 */
public class ParticleScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;
    private static final int MAX_VISIBLE_BLACKLIST_ROWS = 5;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - closing to nothing made every sub-screen exit feel like a dead end. */
    private final Screen parent;
    private TextFieldWidget blacklistField;
    private String statusMessage = "";

    public ParticleScreen(ModConfig config, Screen parent) {
        super(Text.literal("Omega Particles"));
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

        this.addDrawableChild(ButtonWidget.builder(densityText(), b -> {
                    config.particleDensity = ParticleScreenSupport.nextDensityStep(config.particleDensity);
                    b.setMessage(densityText());
                    config.save();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        // init() reruns on window resize (and via clearAndInit), rebuilding every widget - carry
        // the half-typed id across instead of silently wiping it.
        String previousText = blacklistField != null ? blacklistField.getText() : "";
        blacklistField = new TextFieldWidget(this.textRenderer, startX, y, 150, 20, Text.literal("Particle id, e.g. minecraft:soul"));
        blacklistField.setMaxLength(64);
        blacklistField.setText(previousText);
        this.addDrawableChild(blacklistField);
        this.addDrawableChild(ButtonWidget.builder(Text.literal("Add"), b -> addBlacklistEntry())
                .dimensions(startX + 156, y, ROW_WIDTH - 156, 20)
                .build());
        y += ROW_HEIGHT + 4;

        y = addBlacklistRows(startX, y);

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, Math.max(y + 12, this.height - 30), 100, 20)
                .build());
    }

    private int addBlacklistRows(int startX, int y) {
        List<String> blacklist = config.particleBlacklist;
        int shown = Math.min(blacklist.size(), MAX_VISIBLE_BLACKLIST_ROWS);
        for (int i = 0; i < shown; i++) {
            String id = blacklist.get(i);
            this.addDrawableChild(ButtonWidget.builder(Text.literal(id), b -> {})
                    .dimensions(startX, y, 150, 20)
                    .build());
            this.addDrawableChild(ButtonWidget.builder(Text.literal("Remove"), b -> removeBlacklistEntry(id))
                    .dimensions(startX + 156, y, ROW_WIDTH - 156, 20)
                    .build());
            y += ROW_HEIGHT;
        }
        if (blacklist.size() > MAX_VISIBLE_BLACKLIST_ROWS) {
            statusMessage = (blacklist.size() - MAX_VISIBLE_BLACKLIST_ROWS) + " more blacklisted ids not shown.";
        }
        return y;
    }

    private void addBlacklistEntry() {
        String raw = blacklistField.getText().trim();
        if (raw.isEmpty()) return;
        String id = ParticleScreenSupport.normalizeBlacklistId(raw);
        if (!config.particleBlacklist.contains(id)) {
            config.particleBlacklist.add(id);
            config.save();
        }
        blacklistField.setText("");
        statusMessage = "";
        this.clearAndInit();
    }

    private void removeBlacklistEntry(String id) {
        config.particleBlacklist.remove(id);
        config.save();
        this.clearAndInit();
    }

    private Text densityText() {
        return Text.literal("Density: " + Math.round(config.particleDensity * 100) + "%");
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
        int centerX = this.width / 2;
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Particles", centerX, 16, 0xFFFFFF);
        if (!statusMessage.isEmpty()) {
            context.drawCenteredTextWithShadow(this.textRenderer, statusMessage, centerX, this.height - 44, 0xFFD37F);
        }
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
