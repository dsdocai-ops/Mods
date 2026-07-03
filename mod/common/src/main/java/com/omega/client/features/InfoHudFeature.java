package com.omega.client.features;

import com.omega.client.hud.CpsTracker;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.player.LocalPlayer;
import org.lwjgl.glfw.GLFW;

/**
 * Purely informational overlay (coordinates / FPS / ping / facing / CPS / which movement+attack
 * keys are currently held). Nothing here reads data the player couldn't already see through
 * vanilla's own F3 debug screen or tab list - it's just a friendlier always-on subset of it.
 *
 * The text lines are recomputed on the 20/s tick loop and cached, not on every render() call -
 * render() can fire well over 20 times a second (uncapped or high-refresh-rate displays, exactly
 * the setup competitive PvP players tend to run), so formatting fresh strings there was needless
 * GC churn every single frame for numbers that only meaningfully change 20 times a second. The
 * one exception is the CPS tracker's button sampling, which runs per-frame by design: clicks can
 * be shorter than a tick, and 20 Hz sampling would undercount fast clickers (see CpsTracker).
 *
 * Compiles once here against official mappings, remapped per-platform (see FullbrightFeature's
 * javadoc for the general pattern).
 */
public final class InfoHudFeature {
    private static final int TEXT_COLOR = 0xFFFFFF;
    private static final int SHADOW_BG = 0x66000000;
    private static final int KEY_BOX_SIZE = 18;
    private static final int KEY_BOX_GAP = 2;
    private static final String[] KEY_LABELS = {"W", "A", "S", "D", "SP", "LM"};

    private String cachedCoords = "";
    private String cachedFps = "";
    private String cachedPing = "";
    private String cachedDirection = "";
    private KeyMapping[] keyBindings;
    private final CpsTracker cps = new CpsTracker();

    public void tick(HudSettings settings, Minecraft client) {
        if (!settings.enabled()) return;

        if (settings.showCoords() && client.player != null) {
            LocalPlayer p = client.player;
            cachedCoords = String.format("%.1f, %.1f, %.1f", p.getX(), p.getY(), p.getZ());
        }
        if (settings.showFps()) {
            cachedFps = client.getFps() + " fps";
        }
        if (settings.showPing() && client.player != null && client.getConnection() != null) {
            PlayerInfo self = client.getConnection().getPlayerInfo(client.player.getUUID());
            // In singleplayer (or before the tab-list entry arrives) there's no meaningful latency
            // to show - drop the line instead of rendering a fake 0 ms.
            int latency = self != null ? self.getLatency() : 0;
            cachedPing = latency > 0 ? latency + " ms" : "";
        }
        if (settings.showDirection() && client.player != null) {
            cachedDirection = "Facing: " + prettyDirection(client.player.getDirection().getName());
        }
    }

    public void render(GuiGraphics context, HudSettings settings) {
        if (!settings.enabled()) return;

        Minecraft client = Minecraft.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.font.lineHeight + 2;

        if (settings.showCoords() && client.player != null) {
            context.drawString(client.font, cachedCoords, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (settings.showFps()) {
            context.drawString(client.font, cachedFps, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (settings.showPing() && !cachedPing.isEmpty()) {
            context.drawString(client.font, cachedPing, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (settings.showDirection() && !cachedDirection.isEmpty()) {
            context.drawString(client.font, cachedDirection, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (settings.showCps()) {
            long window = client.getWindow().getWindow();
            cps.update(
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS,
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS
            );
            context.drawString(client.font, cps.leftCps() + " | " + cps.rightCps() + " cps", x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (settings.showKeystrokes()) {
            renderKeystrokes(context, client, x, y);
        }
    }

    private static String prettyDirection(String name) {
        return name.isEmpty() ? name : Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    private void renderKeystrokes(GuiGraphics context, Minecraft client, int x, int y) {
        if (keyBindings == null) {
            keyBindings = new KeyMapping[]{
                    client.options.keyUp,
                    client.options.keyLeft,
                    client.options.keyDown,
                    client.options.keyRight,
                    client.options.keyJump,
                    client.options.keyAttack,
            };
        }

        for (int i = 0; i < keyBindings.length; i++) {
            int keyX = x + i * (KEY_BOX_SIZE + KEY_BOX_GAP);
            boolean held = keyBindings[i].isDown();
            int color = held ? 0xFF3B9CFF : SHADOW_BG;
            context.fill(keyX, y, keyX + KEY_BOX_SIZE, y + KEY_BOX_SIZE, color);
            context.drawCenteredString(client.font, KEY_LABELS[i], keyX + KEY_BOX_SIZE / 2, y + KEY_BOX_SIZE / 2 - 4, TEXT_COLOR);
        }
    }
}
