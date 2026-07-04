// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.omega.client.visual.VisualScreenSupport;
import com.omega.client.particle.ParticleScreenSupport;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

import java.util.List;

/**
 * The two Visual & PvP settings that previously only existed in the launcher's Features tab, not
 * anywhere in-game: Custom FOV's actual numbers (the "Custom FOV" on/off switch lives on the main
 * ClickGui, this is just the values it uses) and Block Highlight's color + target block list. Same
 * click-to-cycle-value / add-remove-list patterns as ParticleScreen, see VisualScreenSupport for
 * the pure step/cycle math this reuses.
 */
public class VisualScreen extends Screen {
    private static final int ROW_HEIGHT = 22;
    private static final int ROW_WIDTH = 220;
    private static final int MAX_VISIBLE_BLOCK_ROWS = 5;

    private final ModConfig config;
    /** The menu screen to return to on Back/Esc - see ParticleScreen's identical field for why. */
    private final Screen parent;
    private TextFieldWidget blockIdField;
    private String statusMessage = "";

    public VisualScreen(ModConfig config, Screen parent) {
        super(Text.literal("Omega Visual Settings"));
        this.config = config;
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 36;

        this.addDrawableChild(ButtonWidget.builder(fovText(), b -> {
                    config.customFov = VisualScreenSupport.nextFov(config.customFov);
                    b.setMessage(fovText());
                    config.save();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(zoomFovText(), b -> {
                    config.zoomFov = VisualScreenSupport.nextZoomFov(config.zoomFov);
                    b.setMessage(zoomFovText());
                    config.save();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addDrawableChild(ButtonWidget.builder(highlightColorText(), b -> {
                    config.highlightColorArgb = VisualScreenSupport.nextHighlightColor(config.highlightColorArgb);
                    b.setMessage(highlightColorText());
                    config.save();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        // init() reruns on window resize (and via clearAndInit), rebuilding every widget - carry
        // the half-typed id across instead of silently wiping it (same as ParticleScreen).
        String previousText = blockIdField != null ? blockIdField.getText() : "";
        blockIdField = new TextFieldWidget(this.textRenderer, startX, y, 150, 20, Text.literal("Block id, e.g. minecraft:obsidian"));
        blockIdField.setMaxLength(64);
        blockIdField.setText(previousText);
        this.addDrawableChild(blockIdField);
        this.addDrawableChild(ButtonWidget.builder(Text.literal("Add"), b -> addBlockEntry())
                .dimensions(startX + 156, y, ROW_WIDTH - 156, 20)
                .build());
        y += ROW_HEIGHT + 4;

        y = addBlockRows(startX, y);

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, Math.max(y + 12, this.height - 30), 100, 20)
                .build());
    }

    private int addBlockRows(int startX, int y) {
        List<String> blocks = config.highlightedBlocks;
        int shown = Math.min(blocks.size(), MAX_VISIBLE_BLOCK_ROWS);
        for (int i = 0; i < shown; i++) {
            String id = blocks.get(i);
            this.addDrawableChild(ButtonWidget.builder(Text.literal(id), b -> {})
                    .dimensions(startX, y, 150, 20)
                    .build());
            this.addDrawableChild(ButtonWidget.builder(Text.literal("Remove"), b -> removeBlockEntry(id))
                    .dimensions(startX + 156, y, ROW_WIDTH - 156, 20)
                    .build());
            y += ROW_HEIGHT;
        }
        if (blocks.size() > MAX_VISIBLE_BLOCK_ROWS) {
            statusMessage = (blocks.size() - MAX_VISIBLE_BLOCK_ROWS) + " more highlighted blocks not shown.";
        }
        return y;
    }

    private void addBlockEntry() {
        String raw = blockIdField.getText().trim();
        if (raw.isEmpty()) return;
        String id = ParticleScreenSupport.normalizeNamespacedId(raw);
        if (!config.highlightedBlocks.contains(id)) {
            config.highlightedBlocks.add(id);
            config.save();
        }
        blockIdField.setText("");
        statusMessage = "";
        this.clearAndInit();
    }

    private void removeBlockEntry(String id) {
        config.highlightedBlocks.remove(id);
        config.save();
        this.clearAndInit();
    }

    private Text fovText() {
        return Text.literal("FOV: " + config.customFov);
    }

    private Text zoomFovText() {
        return Text.literal("Zoom FOV (hold C): " + config.zoomFov);
    }

    private Text highlightColorText() {
        return Text.literal("Highlight color: " + VisualScreenSupport.highlightColorLabel(config.highlightColorArgb));
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Visual Settings", centerX, 16, 0xFFFFFF);
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
