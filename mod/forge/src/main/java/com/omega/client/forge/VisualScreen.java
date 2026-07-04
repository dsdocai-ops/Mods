// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import com.omega.client.ModConfig;
import com.omega.client.particle.ParticleScreenSupport;
import com.omega.client.visual.VisualScreenSupport;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.List;

/**
 * Forge-side twin of the Fabric VisualScreen - see that class for what/why. Same renames as every
 * other Forge screen here vs. Yarn: Text -> Component, ButtonWidget -> Button, TextFieldWidget ->
 * EditBox, DrawContext -> GuiGraphics, addDrawableChild -> addRenderableWidget,
 * .dimensions(...) -> .bounds(...), clearAndInit() -> clearWidgets()+init().
 */
public class VisualScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;
    private static final int MAX_VISIBLE_BLOCK_ROWS = 5;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;
    private EditBox blockIdField;
    private String statusMessage = "";

    public VisualScreen(ModConfig config, Screen parent) {
        super(Component.literal("Omega Visual Settings"));
        this.config = config;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 36;

        this.addRenderableWidget(Button.builder(fovText(), b -> {
                    config.customFov = VisualScreenSupport.nextFov(config.customFov);
                    b.setMessage(fovText());
                    config.save();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(zoomFovText(), b -> {
                    config.zoomFov = VisualScreenSupport.nextZoomFov(config.zoomFov);
                    b.setMessage(zoomFovText());
                    config.save();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addRenderableWidget(Button.builder(highlightColorText(), b -> {
                    config.highlightColorArgb = VisualScreenSupport.nextHighlightColor(config.highlightColorArgb);
                    b.setMessage(highlightColorText());
                    config.save();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        // init() reruns on window resize (and via the clearWidgets()+init() refresh pattern),
        // rebuilding every widget - carry the half-typed id across instead of silently wiping it
        // (same as ParticleScreen).
        String previousText = blockIdField != null ? blockIdField.getValue() : "";
        blockIdField = new EditBox(this.font, startX, y, 150, 20, Component.literal("Block id, e.g. minecraft:obsidian"));
        blockIdField.setMaxLength(64);
        blockIdField.setValue(previousText);
        this.addRenderableWidget(blockIdField);
        this.addRenderableWidget(Button.builder(Component.literal("Add"), b -> addBlockEntry())
                .bounds(startX + 156, y, ROW_WIDTH - 156, 20)
                .build());
        y += ROW_HEIGHT + 4;

        y = addBlockRows(startX, y);

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, Math.max(y + 12, this.height - 30), 100, 20)
                .build());
    }

    private int addBlockRows(int startX, int y) {
        List<String> blocks = config.highlightedBlocks;
        int shown = Math.min(blocks.size(), MAX_VISIBLE_BLOCK_ROWS);
        for (int i = 0; i < shown; i++) {
            String id = blocks.get(i);
            this.addRenderableWidget(Button.builder(Component.literal(id), b -> {})
                    .bounds(startX, y, 150, 20)
                    .build());
            this.addRenderableWidget(Button.builder(Component.literal("Remove"), b -> removeBlockEntry(id))
                    .bounds(startX + 156, y, ROW_WIDTH - 156, 20)
                    .build());
            y += ROW_HEIGHT;
        }
        if (blocks.size() > MAX_VISIBLE_BLOCK_ROWS) {
            statusMessage = (blocks.size() - MAX_VISIBLE_BLOCK_ROWS) + " more highlighted blocks not shown.";
        }
        return y;
    }

    private void addBlockEntry() {
        String raw = blockIdField.getValue().trim();
        if (raw.isEmpty()) return;
        String id = ParticleScreenSupport.normalizeNamespacedId(raw);
        if (!config.highlightedBlocks.contains(id)) {
            config.highlightedBlocks.add(id);
            config.save();
        }
        blockIdField.setValue("");
        statusMessage = "";
        this.clearWidgets();
        this.init();
    }

    private void removeBlockEntry(String id) {
        config.highlightedBlocks.remove(id);
        config.save();
        this.clearWidgets();
        this.init();
    }

    private Component fovText() {
        return Component.literal("FOV: " + config.customFov);
    }

    private Component zoomFovText() {
        return Component.literal("Zoom FOV (hold C): " + config.zoomFov);
    }

    private Component highlightColorText() {
        return Component.literal("Highlight color: " + VisualScreenSupport.highlightColorLabel(config.highlightColorArgb));
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredString(this.font, "Omega Visual Settings", centerX, 16, 0xFFFFFF);
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
