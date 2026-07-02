package com.omega.client.forge.schematic;

import com.omega.client.forge.ModConfig;
import com.omega.client.schematic.SchematicData;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * Forge-side twin of the Fabric SchematicScreen. Renames vs. Yarn: TextFieldWidget -> EditBox,
 * ButtonWidget -> Button, DrawContext -> GuiGraphics, Text -> Component, addDrawableChild ->
 * addRenderableWidget, client.world -> client.level, player.getBlockPos() -> player.blockPosition().
 */
public class SchematicScreen extends Screen {
    private static final int MAX_VISIBLE_SAVED_ROWS = 5;
    private static final int MAX_VISIBLE_IMPORT_ROWS = 3;

    private final ModConfig config;
    private final SchematicSelection selection;
    private final SchematicRenderFeature renderFeature;
    /** The menu screen to return to on Back/Esc - closing to nothing made every sub-screen exit feel like a dead end. */
    private final Screen parent;

    private EditBox nameField;
    private String statusMessage = "";

    public SchematicScreen(ModConfig config, SchematicSelection selection, SchematicRenderFeature renderFeature, Screen parent) {
        super(Component.literal("Omega Schematics"));
        this.config = config;
        this.selection = selection;
        this.renderFeature = renderFeature;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int y = 46;

        // init() reruns on window resize (and via the clearWidgets()+init() refresh pattern),
        // rebuilding every widget - carry the half-typed name across instead of silently wiping it.
        String previousName = nameField != null ? nameField.getValue() : "";
        nameField = new EditBox(this.font, centerX - 150, y, 190, 20, Component.literal("Schematic name"));
        nameField.setMaxLength(64);
        nameField.setValue(previousName);
        this.addRenderableWidget(nameField);
        this.addRenderableWidget(Button.builder(Component.literal("Save Selection"), b -> saveSelection())
                .bounds(centerX + 45, y, 110, 20)
                .build());
        y += 30;

        y = addLitematicImportRows(centerX, y);
        y = addSavedSchematicRows(centerX, y);

        int bottomY = Math.max(y + 16, this.height - 60);
        this.addRenderableWidget(Button.builder(Component.literal(config.schematicPreviewEnabled ? "Hide Preview" : "Show Preview"), b -> togglePreview())
                .bounds(centerX - 110, bottomY, 100, 20)
                .build());
        this.addRenderableWidget(Button.builder(Component.literal("Re-anchor to Me"), b -> reanchor())
                .bounds(centerX + 10, bottomY, 100, 20)
                .build());

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, this.height - 30, 100, 20)
                .build());
    }

    private int addLitematicImportRows(int centerX, int y) {
        List<Path> litematicFiles = SchematicStorage.listLitematicFiles();
        if (litematicFiles.isEmpty()) return y;

        int shown = Math.min(litematicFiles.size(), MAX_VISIBLE_IMPORT_ROWS);
        for (int i = 0; i < shown; i++) {
            Path file = litematicFiles.get(i);
            String fileName = file.getFileName().toString();
            this.addRenderableWidget(Button.builder(Component.literal("Import: " + fileName), b -> importLitematic(file))
                    .bounds(centerX - 160, y, 320, 20)
                    .build());
            y += 24;
        }
        return y + 6;
    }

    private int addSavedSchematicRows(int centerX, int y) {
        List<String> names = SchematicStorage.listNames();
        int shown = Math.min(names.size(), MAX_VISIBLE_SAVED_ROWS);
        for (int i = 0; i < shown; i++) {
            String name = names.get(i);
            this.addRenderableWidget(Button.builder(Component.literal(name), b -> loadAndPreview(name))
                    .bounds(centerX - 160, y, 220, 20)
                    .build());
            this.addRenderableWidget(Button.builder(Component.literal("Delete"), b -> {
                        SchematicStorage.delete(name);
                        this.clearWidgets();
                        this.init();
                    })
                    .bounds(centerX + 65, y, 95, 20)
                    .build());
            y += 24;
        }
        if (names.size() > MAX_VISIBLE_SAVED_ROWS) {
            statusMessage = (names.size() - MAX_VISIBLE_SAVED_ROWS) + " more saved schematics not shown.";
        }
        return y;
    }

    private void saveSelection() {
        if (!selection.isComplete()) {
            statusMessage = "Set both positions first (Pos 1 / Pos 2 keybinds).";
            return;
        }
        String name = nameField.getValue().trim();
        if (name.isEmpty()) name = "schematic-" + System.currentTimeMillis();

        Minecraft client = Minecraft.getInstance();
        if (client.level == null) return;

        try {
            SchematicData data = new SchematicCaptureFeature().capture(client.level, selection, name);
            SchematicStorage.save(data);
            statusMessage = "Saved \"" + name + "\" (" + data.blocks.size() + " blocks).";
        } catch (IllegalArgumentException | IllegalStateException e) {
            statusMessage = e.getMessage();
            return;
        } catch (IOException e) {
            statusMessage = "Failed to save: " + e.getMessage();
            return;
        }
        refresh();
    }

    private void importLitematic(Path file) {
        String fileName = file.getFileName().toString();
        String name = fileName.toLowerCase().endsWith(".litematic") ? fileName.substring(0, fileName.length() - ".litematic".length()) : fileName;
        try {
            SchematicData data = LitematicaImporter.importFile(file, name);
            SchematicStorage.save(data);
            statusMessage = "Imported \"" + name + "\" (" + data.blocks.size() + " blocks) - best-effort, double check it looks right before building.";
        } catch (IOException | RuntimeException e) {
            // Broad catch is deliberate - see LitematicaImporter's doc comment.
            statusMessage = "Import failed: " + e.getMessage();
        }
        refresh();
    }

    private void loadAndPreview(String name) {
        try {
            SchematicData data = SchematicStorage.load(name);
            renderFeature.setActive(data);
            Minecraft client = Minecraft.getInstance();
            if (client.player != null) {
                renderFeature.setOrigin(client.player.blockPosition());
            }
            config.schematicPreviewEnabled = true;
            config.save();
            statusMessage = "Previewing \"" + name + "\" - stand where you want it and use Re-anchor to Me.";
        } catch (IOException e) {
            statusMessage = "Failed to load: " + e.getMessage();
        }
        refresh();
    }

    private void togglePreview() {
        config.schematicPreviewEnabled = !config.schematicPreviewEnabled;
        config.save();
        refresh();
    }

    private void reanchor() {
        Minecraft client = Minecraft.getInstance();
        if (client.player != null) {
            renderFeature.setOrigin(client.player.blockPosition());
            statusMessage = "Re-anchored to your position.";
        }
    }

    private void refresh() {
        this.clearWidgets();
        this.init();
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);

        int centerX = this.width / 2;
        context.drawCenteredString(this.font, "Omega Schematics", centerX, 16, 0xFFFFFF);

        String selectionText = selectionStatusText();
        context.drawCenteredString(this.font, selectionText, centerX, 30, 0xAAAAAA);

        if (!statusMessage.isEmpty()) {
            context.drawCenteredString(this.font, statusMessage, centerX, this.height - 44, 0xFFD37F);
        }
    }

    private String selectionStatusText() {
        BlockPos p1 = selection.getPos1();
        BlockPos p2 = selection.getPos2();
        String pos1Text = p1 == null ? "not set" : p1.getX() + "," + p1.getY() + "," + p1.getZ();
        String pos2Text = p2 == null ? "not set" : p2.getX() + "," + p2.getY() + "," + p2.getZ();
        return "Pos 1: " + pos1Text + "   Pos 2: " + pos2Text;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        if (this.minecraft != null) this.minecraft.setScreen(parent);
    }
}
