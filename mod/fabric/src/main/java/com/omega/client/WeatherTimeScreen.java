package com.omega.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Weather & time changer: buttons that send the real vanilla <code>/time set</code> and
 * <code>/weather</code> commands, the same as typing them in chat. This is deliberately not a
 * client-side visual override like "Clear Weather" in the Features tab (that one only changes what
 * *you* see and never touches the world) - these buttons ask the server to actually change it,
 * which only succeeds where the player already has permission to run those commands: singleplayer
 * (the integrated server grants the host operator status automatically) or op'd on a multiplayer
 * server. Without permission the server just rejects the command exactly as it would from chat -
 * this screen adds no permission the player didn't already have.
 */
public class WeatherTimeScreen extends Screen {
    private static final int ROW_HEIGHT = 24;
    private static final int ROW_WIDTH = 220;

    /** The menu screen to return to on Back/Esc, matching every other Omega sub-screen. */
    private final Screen parent;
    private String statusMessage = "";
    // Section header y-positions, computed in init() and read back in render() - fixed constants
    // there would drift out of sync with the actual button layout the moment either changes.
    private int timeLabelY;
    private int weatherLabelY;

    public WeatherTimeScreen(Screen parent) {
        super(Text.literal("Omega Weather & Time"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int startX = centerX - ROW_WIDTH / 2;
        int y = 44;

        timeLabelY = y;
        y += 16;
        addCommandRow(startX, y, "Day", "time set day");
        y += ROW_HEIGHT;
        addCommandRow(startX, y, "Noon", "time set noon");
        y += ROW_HEIGHT;
        addCommandRow(startX, y, "Night", "time set night");
        y += ROW_HEIGHT;
        addCommandRow(startX, y, "Midnight", "time set midnight");
        y += ROW_HEIGHT + 10;

        weatherLabelY = y;
        y += 16;
        addCommandRow(startX, y, "Clear", "weather clear");
        y += ROW_HEIGHT;
        addCommandRow(startX, y, "Rain", "weather rain");
        y += ROW_HEIGHT;
        addCommandRow(startX, y, "Thunder", "weather thunder");
        y += ROW_HEIGHT + 10;

        this.addDrawableChild(ButtonWidget.builder(Text.literal("Back"), b -> this.close())
                .dimensions(centerX - 50, y, 100, 20)
                .build());
    }

    private void addCommandRow(int x, int y, String label, String command) {
        this.addDrawableChild(ButtonWidget.builder(Text.literal(label), b -> sendCommand(command))
                .dimensions(x, y, ROW_WIDTH, 20)
                .build());
    }

    private void sendCommand(String command) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.getNetworkHandler() == null) return;
        client.getNetworkHandler().sendChatCommand(command);
        statusMessage = "Sent: /" + command;
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredTextWithShadow(this.textRenderer, "Omega Weather & Time", centerX, 16, 0xFFFFFF);
        context.drawCenteredTextWithShadow(this.textRenderer, "Time", centerX, timeLabelY, 0xAAAAAA);
        context.drawCenteredTextWithShadow(this.textRenderer, "Weather", centerX, weatherLabelY, 0xAAAAAA);
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
        if (this.client != null) this.client.setScreen(parent);
    }
}
