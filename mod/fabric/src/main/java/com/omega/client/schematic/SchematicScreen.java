package com.omega.client.schematic;

import com.omega.client.ModConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/** Lists saved schematics and lets you save the current selection, import a .litematic file, preview/place one, or delete it. */
public class SchematicScreen extends Screen {
    private static final int MAX_VISIBLE_SAVED_ROWS = 5;
    private static final int MAX_VISIBLE_IMPORT_ROWS = 3;

    private final ModConfig config;
    private final SchematicSelection selection;
    private final SchematicRenderFeature renderFeature;
    /** The menu screen to return to on Back/Esc - closing to nothing made every sub-screen exit feel like a dead end. */
    private final Screen parent;

    private TextFieldWidget nameField;
    private String statusMessage = "";

    public SchematicScreen(ModConfig config, SchematicSelection selection, SchematicRenderFeature renderFeature, Screen parent) {
        super(Text.literal("Omega Schematics"));
        this.config = config;
        this.selection = selection;
        this.renderFeature = renderFeature;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int y = 46;

        // init() reruns on window resize (and via clearAndInit), rebuilding every widget - carry
        // the half-typed name across instead of silently wiping it.
        String previousName = nameField != null ? nameField.getText() : "";
        nameField = new TextFieldWidget(this.textRenderer, centerX - 150, y, 190, 20, Text.literal("Schematic name"));
        nameField.setMaxLength(64);
        nameField.setText(previousName);
        this.addDrawableChild(nameField);
        this.addDrawableChild(ButtonWidget.builder(Text.literal("Save Selection"), b -> saveSelection())
                .dimensions(centerX + 45, y, 110, 20)
                .build());
        y += 30;

        y = addLitematicImportRows(centerX, y);
        y = addSavedSchematicRows(centerX, y);

        int bottomY = Math.max(y + 16, this.height - 60);
        this.addDrawableChild(ButtonWidget.builder(Text.literal(config.schematicPreviewEnabled ? "Hide Preview" : "Show Preview"), b -> togglePreview())
                .dimensions(centerX - 110, bottomY, 100, 20)
                .build());
        this.addDrawableChild(ButtonWidget.builder(Text.literal("Re-anchor to Me"), b -> reanchor())
                .dimensions(centerX + 10, bottomY, 100, 20)
                .build());

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, this.height - 30, 100, 20)
                .build());
    }

    private int addLitematicImportRows(int centerX, int y) {
        List<Path> litematicFiles = SchematicStorage.listLitematicFiles();
        if (litematicFiles.isEmpty()) return y;

        int shown = Math.min(litematicFiles.size(), MAX_VISIBLE_IMPORT_ROWS);
        for (int i = 0; i < shown; i++) {
            Path file = litematicFiles.get(i);
            String fileName = file.getFileName().toString();
            this.addDrawableChild(ButtonWidget.builder(Text.literal("Import: " + fileName), b -> importLitematic(file))
                    .dimensions(centerX - 160, y, 320, 20)
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
            this.addDrawableChild(ButtonWidget.builder(Text.literal(name), b -> loadAndPreview(name))
                    .dimensions(centerX - 160, y, 220, 20)
                    .build());
            this.addDrawableChild(ButtonWidget.builder(Text.literal("Delete"), b -> {
                        SchematicStorage.delete(name);
                        this.clearAndInit();
                    })
                    .dimensions(centerX + 65, y, 95, 20)
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
        String name = nameField.getText().trim();
        if (name.isEmpty()) name = "schematic-" + System.currentTimeMillis();

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null) return;

        try {
            SchematicData data = new SchematicCaptureFeature().capture(client.world, selection, name);
            SchematicStorage.save(data);
            statusMessage = "Saved \"" + name + "\" (" + data.blocks.size() + " blocks).";
        } catch (IllegalArgumentException | IllegalStateException e) {
            statusMessage = e.getMessage();
            return;
        } catch (IOException e) {
            statusMessage = "Failed to save: " + e.getMessage();
            return;
        }
        this.clearAndInit();
    }

    private void importLitematic(Path file) {
        String fileName = file.getFileName().toString();
        String name = LitematicaBitPacking.stripLitematicExtension(fileName);
        try {
            SchematicData data = LitematicaImporter.importFile(file, name);
            SchematicStorage.save(data);
            statusMessage = "Imported \"" + name + "\" (" + data.blocks.size() + " blocks) - best-effort, double check it looks right before building.";
        } catch (IOException | RuntimeException e) {
            // Broad catch is deliberate: LitematicaImporter is reconstructed from memory of an
            // undocumented format, so a wrong structural assumption could throw almost anything
            // (NPE, class cast, index-out-of-bounds) - all of that should end in a status message,
            // not a crashed client.
            statusMessage = "Import failed: " + e.getMessage();
        }
        this.clearAndInit();
    }

    private void loadAndPreview(String name) {
        try {
            SchematicData data = SchematicStorage.load(name);
            renderFeature.setActive(data);
            MinecraftClient client = MinecraftClient.getInstance();
            if (client.player != null) {
                renderFeature.setOrigin(client.player.getBlockPos());
            }
            config.schematicPreviewEnabled = true;
            config.save();
            statusMessage = "Previewing \"" + name + "\" - stand where you want it and use Re-anchor to Me.";
        } catch (IOException e) {
            statusMessage = "Failed to load: " + e.getMessage();
        }
        this.clearAndInit();
    }

    private void togglePreview() {
        config.schematicPreviewEnabled = !config.schematicPreviewEnabled;
        config.save();
        this.clearAndInit();
    }

    private void reanchor() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player != null) {
            renderFeature.setOrigin(client.player.getBlockPos());
            statusMessage = "Re-anchored to your position.";
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);

        int centerX = this.width / 2;
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Schematics", centerX, 16, 0xFFFFFF);

        String selectionText = selectionStatusText();
        context.drawCenteredTextWithShadow(this.textRenderer, selectionText, centerX, 30, 0xAAAAAA);

        if (!statusMessage.isEmpty()) {
            context.drawCenteredTextWithShadow(this.textRenderer, statusMessage, centerX, this.height - 44, 0xFFD37F);
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
    public boolean shouldPause() {
        return false;
    }

    @Override
    public void close() {
        if (this.client != null) this.client.setScreen(parent);
    }
}
