// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Forge-side twin of the Fabric WeatherTimeScreen - see that file for the full rationale (these
 * buttons send the real vanilla <code>/time set</code>/<code>/weather</code> commands, exactly as
 * typing them in chat would, so they only succeed where the player already has permission).
 * `ClientPacketListener.sendCommand(String)` is the guessed official-mappings equivalent of Yarn's
 * `ClientPlayNetworkHandler.sendChatCommand(String)` - same moderate-confidence class of guess as
 * the rest of this module's fresh Forge translations, see mod/README.md.
 */
public class WeatherTimeScreen extends Screen {
    private static final int ROW_HEIGHT = 24;
    private static final int ROW_WIDTH = 220;

    private final Screen parent;
    private String statusMessage = "";
    private int timeLabelY;
    private int weatherLabelY;

    public WeatherTimeScreen(Screen parent) {
        super(Component.literal("Omega Weather & Time"));
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

        this.addRenderableWidget(Button.builder(Component.literal("Back"), b -> this.onClose())
                .bounds(centerX - 50, y, 100, 20)
                .build());
    }

    private void addCommandRow(int x, int y, String label, String command) {
        this.addRenderableWidget(Button.builder(Component.literal(label), b -> sendCommand(command))
                .bounds(x, y, ROW_WIDTH, 20)
                .build());
    }

    private void sendCommand(String command) {
        Minecraft client = Minecraft.getInstance();
        if (client.player == null || client.getConnection() == null) return;
        client.getConnection().sendCommand(command);
        statusMessage = "Sent: /" + command;
    }

    @Override
    public void render(GuiGraphics context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int centerX = this.width / 2;
        context.drawCenteredString(this.font, "Omega Weather & Time", centerX, 16, 0xFFFFFF);
        context.drawCenteredString(this.font, "Time", centerX, timeLabelY, 0xAAAAAA);
        context.drawCenteredString(this.font, "Weather", centerX, weatherLabelY, 0xAAAAAA);
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
        if (this.minecraft != null) this.minecraft.setScreen(parent);
    }
}
