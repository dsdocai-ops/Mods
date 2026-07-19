// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import com.omega.client.ModConfig;
import com.omega.client.SessionInfoLoader;
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
        // Two columns of toggle rows: the feature list outgrew a single column - at vanilla's
        // "auto" GUI scale on 1080p the scaled screen is only ~270px tall, and nine stacked rows
        // plus the nav buttons would push "Done" off-screen.
        int toggleRows = 5;
        int contentHeight = 34 + toggleRows * ROW_HEIGHT + ROW_HEIGHT * 6 + 8 + ROW_HEIGHT + 8 + 20;
        headerY = Math.max(6, (this.height - contentHeight) / 2);
        int leftX = this.width / 2 - ROW_WIDTH - 4;
        int rightX = this.width / 2 + 4;
        int startX = this.width / 2 - ROW_WIDTH / 2;
        int topY = headerY + 34;
        int y = topY;

        addToggleRow(leftX, y, "Fullbright", () -> config.fullbrightEnabled, v -> config.fullbrightEnabled = v);
        addToggleRow(rightX, y, "Show Omega Users (\u03a9 badge)", () -> config.showOmegaUsersEnabled, v -> config.showOmegaUsersEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(leftX, y, "Block Highlight (combat clarity)", () -> config.blockHighlightEnabled, v -> config.blockHighlightEnabled = v);
        addToggleRow(rightX, y, "No Hurt Camera", () -> config.noHurtCamEnabled, v -> config.noHurtCamEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(leftX, y, "Custom FOV", () -> config.customFovEnabled, v -> config.customFovEnabled = v);
        addToggleRow(rightX, y, "No Fog", () -> config.noFogEnabled, v -> config.noFogEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(leftX, y, "Toggle Sprint", () -> config.toggleSprintEnabled, v -> config.toggleSprintEnabled = v);
        addToggleRow(rightX, y, "Clear Weather (visual)", () -> config.clearWeatherEnabled, v -> config.clearWeatherEnabled = v);
        y += ROW_HEIGHT;
        addToggleRow(leftX, y, "Info HUD", () -> config.hudEnabled, v -> config.hudEnabled = v);
        // Applies on the next launch, not live: the launcher reads this to decide the low-latency
        // G1GC flags, and JVM GC flags can't change mid-run. Label says so.
        addToggleRow(rightX, y, "Smooth PvP (next launch)", () -> config.smoothPvpEnabled, v -> config.smoothPvpEnabled = v);
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Schematics..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new SchematicScreen(config, selection, schematicRender, this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Particles..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new ParticleScreen(config, this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Cosmetics..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new CosmeticsScreen(config, this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Weather & Time..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new WeatherTimeScreen(this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("HUD..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new HudScreen(config, this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Visual Settings..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new VisualScreen(config, this));
                })
                .bounds(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addRenderableWidget(Button.builder(Component.literal("Cosmetics..."), b -> {
                    if (this.minecraft != null) this.minecraft.setScreen(new CosmeticsScreen(config, this));
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
        ToggleRowSupport.addToggleRow(this::addRenderableWidget, x, y, ROW_WIDTH, label, getter, setter, config::save);
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
