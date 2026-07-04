// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.omega.client.particle.ParticleScreen;
import com.omega.client.schematic.SchematicRenderFeature;
import com.omega.client.schematic.SchematicScreen;
import com.omega.client.schematic.SchematicSelection;
import com.omega.client.session.SessionInfo;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * The in-game toggle menu (default keybind: Right Shift). Every row is a plain on/off switch over
 * a ModConfig field - no automation, no combat assistance, just visual/QoL settings. Also shows the
 * active account (from the launcher's session file) with a two-click-confirm "Switch Account"
 * button - Minecraft has no live account-swap API, so this just quits cleanly and signals the
 * launcher to reopen its own account switcher; see SessionInfoLoader.
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
        super(Text.literal("Omega Client"));
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
        int contentHeight = 34 + toggleRows * ROW_HEIGHT + ROW_HEIGHT * 5 + 8 + ROW_HEIGHT + 8 + 20;
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
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Schematics..."), b -> {
                    if (this.client != null) this.client.setScreen(new SchematicScreen(config, selection, schematicRender, this));
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Particles..."), b -> {
                    if (this.client != null) this.client.setScreen(new ParticleScreen(config, this));
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Weather & Time..."), b -> {
                    if (this.client != null) this.client.setScreen(new WeatherTimeScreen(this));
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("HUD..."), b -> {
                    if (this.client != null) this.client.setScreen(new HudScreen(config, this));
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Visual Settings..."), b -> {
                    if (this.client != null) this.client.setScreen(new VisualScreen(config, this));
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addDrawableChild(ButtonWidget.builder(switchAccountText(), b -> {
                    if (!confirmingSwitch) {
                        confirmingSwitch = true;
                        b.setMessage(switchAccountText());
                        return;
                    }
                    SessionInfoLoader.requestAccountSwitch();
                    if (this.client != null) this.client.scheduleStop();
                })
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
        y += ROW_HEIGHT + 8;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Done"), button -> this.close())
                .dimensions(startX, y, ROW_WIDTH, 20)
                .build());
    }

    private Text switchAccountText() {
        return Text.literal(confirmingSwitch ? "Click again to quit & switch" : "Switch Account");
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Client", this.width / 2, headerY, 0xFFFFFF);
        context.drawCenteredTextWithShadow(this.textRenderer, SLOGAN, this.width / 2, headerY + 12, 0xAAAAAA);
        String accountLine = "Playing as: " + session.username + " (" + session.accountType + ")";
        context.drawCenteredTextWithShadow(this.textRenderer, accountLine, this.width / 2, headerY + 24, 0xAAAAAA);
    }

    private void addToggleRow(int x, int y, String label, java.util.function.BooleanSupplier getter, java.util.function.Consumer<Boolean> setter) {
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
    public boolean shouldPause() {
        return false;
    }

    @Override
    public void close() {
        config.save();
        if (this.client != null) this.client.setScreen(null);
    }
}
