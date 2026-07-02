package com.omega.client.features;

import com.omega.client.ModConfig;
import com.omega.client.hud.CpsTracker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
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
    private KeyBinding[] keyBindings;
    private final CpsTracker cps = new CpsTracker();

    public void tick(ModConfig config, MinecraftClient client) {
        if (!config.hudEnabled) return;

        if (config.hudShowCoords && client.player != null) {
            ClientPlayerEntity p = client.player;
            cachedCoords = String.format("%.1f, %.1f, %.1f", p.getX(), p.getY(), p.getZ());
        }
        if (config.hudShowFps) {
            cachedFps = client.getCurrentFps() + " fps";
        }
        if (config.hudShowPing && client.player != null && client.getNetworkHandler() != null) {
            PlayerListEntry self = client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
            // In singleplayer (or before the tab-list entry arrives) there's no meaningful latency
            // to show - drop the line instead of rendering a fake 0 ms.
            int latency = self != null ? self.getLatency() : 0;
            cachedPing = latency > 0 ? latency + " ms" : "";
        }
        if (config.hudShowDirection && client.player != null) {
            cachedDirection = "Facing: " + prettyDirection(client.player.getHorizontalFacing().getName());
        }
    }

    public void render(DrawContext context, ModConfig config) {
        if (!config.hudEnabled) return;

        MinecraftClient client = MinecraftClient.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.textRenderer.fontHeight + 2;

        if (config.hudShowCoords && client.player != null) {
            context.drawTextWithShadow(client.textRenderer, cachedCoords, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowFps) {
            context.drawTextWithShadow(client.textRenderer, cachedFps, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowPing && !cachedPing.isEmpty()) {
            context.drawTextWithShadow(client.textRenderer, cachedPing, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowDirection && !cachedDirection.isEmpty()) {
            context.drawTextWithShadow(client.textRenderer, cachedDirection, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowCps) {
            long window = client.getWindow().getHandle();
            cps.update(
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS,
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS
            );
            context.drawTextWithShadow(client.textRenderer, cps.leftCps() + " | " + cps.rightCps() + " cps", x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowKeystrokes) {
            renderKeystrokes(context, client, x, y);
        }
    }

    private static String prettyDirection(String name) {
        return name.isEmpty() ? name : Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    private void renderKeystrokes(DrawContext context, MinecraftClient client, int x, int y) {
        if (keyBindings == null) {
            keyBindings = new KeyBinding[]{
                    client.options.forwardKey,
                    client.options.leftKey,
                    client.options.backKey,
                    client.options.rightKey,
                    client.options.jumpKey,
                    client.options.attackKey,
            };
        }

        for (int i = 0; i < keyBindings.length; i++) {
            int keyX = x + i * (KEY_BOX_SIZE + KEY_BOX_GAP);
            boolean held = keyBindings[i].isPressed();
            int color = held ? 0xFF3B9CFF : SHADOW_BG;
            context.fill(keyX, y, keyX + KEY_BOX_SIZE, y + KEY_BOX_SIZE, color);
            context.drawCenteredTextWithShadow(client.textRenderer, KEY_LABELS[i], keyX + KEY_BOX_SIZE / 2, y + KEY_BOX_SIZE / 2 - 4, TEXT_COLOR);
        }
    }
}
