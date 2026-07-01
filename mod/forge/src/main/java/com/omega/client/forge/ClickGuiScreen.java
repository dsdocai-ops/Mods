package com.omega.client.forge;

import com.omega.client.forge.particle.ParticleScreen;
import com.omega.client.forge.schematic.SchematicRenderFeature;
import com.omega.client.forge.schematic.SchematicScreen;
import com.omega.client.forge.schematic.SchematicSelection;
import com.omega.client.session.SessionInfo;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Forge-side twin of the Fabric ClickGuiScreen. Class renames applied vs. Yarn: Text -> Component,
 * ButtonWidget -> Button, DrawContext -> GuiGraphics, Screen.client -> Screen.minecraft,
 * Screen.textRenderer -> Screen.font, addDrawableChild -> addRenderableWidget,
 * ButtonWidget.dimensions(...) -> Button.bounds(...). These are well-established renames for the
 * first several; `.bounds(...)` matching Yarn's convenience `.dimensions(...)` one-call shape is
 * the lowest-confidence guess in this file. Also shows the active account (from the launcher's
 * session file) with a two-click-confirm "Switch Account" button - see the Fabric side's
 * ClickGuiScreen for the full rationale; `Minecraft.stop()` as the equivalent of Yarn's
 * `MinecraftClient.scheduleStop()` is a moderate-confidence guess, see mod/README.md.
 */
public class ClickGuiScreen extends Screen {
    private static final String SLOGAN = "The last client you will ever need.";

    private final ModConfig config;
    private final SchematicSelection selection;
    private final SchematicRenderFeature schematicRender;
    private final SessionInfo session;
    private static final int ROW_HEIGHT = 24;
    private static final int ROW_WIDTH = 220;

    private int headerY;
    private boolean confirmingSwitch = false;

    public ClickGuiScreen(ModConfig config, SchematicSelection selection, SchematicRenderFeature schematicRender, SessionInfo session) {
        super(Component.literal("Omega Client"));
        this.config = config;
        this.selection = selection;
        this.schematicRender = schematicRender;
        this.session = session;
    }

    @Override
    protected void init() {
        int startX = this.width / 2 - ROW_WIDTH / 2;
        headerY = this.height / 2 - (ROW_HEIGHT * 7) - 34;
        int y = headerY + 34;

        addToggleRow(startX, y, "Fullbright", () -> config.fullbrightEnabled, v -> config.fullbrightEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Block Highlight (combat clarity)", () -> config.blockHighlightEnabled, v -> config.blockHighlightEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Custom FOV", () -> config.customFovEnabled, v -> config.customFovEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Toggle Sprint", () -> config.toggleSprintEnabled, v -> config.toggleSprintEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(startX, y, "Info HUD", () -> config.hudEnabled, v -> config.hudEnabled = v);
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Schematics..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new SchematicScreen(config, selection, schematicRender));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Particles..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new ParticleScreen(config));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addRenderableWidget(Button.builder(switchAccountText(), b -> {
                    if (!confirmingSwitch) {
                        confirmingSwitch = true;
                        b.setMessage(switchAccountText());
                        return;
                    }
                    SessionInfoLoader.requestAccountSwitch();
                    if (this.minecraft != null) this.minecraft.stop();
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addRenderableWidget(Button.builder(Component.literal("Done"), button -> this.onClose())
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
    }

    private Component switchAccountText() {
        return Component.literal(confirmingSwitch ? "Click again to quit & switch" : "Switch Account");
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredString(this.font, "Omega Client", this.width / 2, headerY, 0xFFFFFF);
        context.drawCenteredString(this.font, SLOGAN, this.width / 2, headerY + 12, 0xAAAAAA);
        String accountLine = "Playing as: " + session.username + " (" + session.accountType + ")";
        context.drawCenteredString(this.font, accountLine, this.width / 2, headerY + 24, 0xAAAAAA);
    }

    private void addToggleRow(int x, int y, String label, java.util.function.BooleanSupplier getter, java.util.function.Consumer<Boolean> setter) {
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
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        config.save();
        if (this.minecraft != null) this.minecraft.setScreen(null);
    }
}
