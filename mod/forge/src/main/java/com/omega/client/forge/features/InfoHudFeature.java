package com.omega.client.forge.features;

import com.omega.client.forge.ModConfig;
import com.omega.client.hud.CpsTracker;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.player.LocalPlayer;
import org.lwjgl.glfw.GLFW;

/**
 * Forge-side twin of the Fabric InfoHudFeature. The GuiGraphics/Font/KeyMapping renames from
 * Yarn's DrawContext/TextRenderer/KeyBinding are well-established official-mappings names (higher
 * confidence); the exact drawString/fill overload shapes, the keyUp/keyAttack field names, and the
 * ping lookup chain (getConnection().getPlayerInfo() vs Yarn's
 * getNetworkHandler().getPlayerListEntry()) are lower-confidence guesses - see mod/README.md.
 * Same caching rule as the Fabric side: strings recomputed 20/s in tick(), only the CPS button
 * sampling runs per-frame (clicks can be shorter than a tick - see CpsTracker).
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

    public void tick(ModConfig config, Minecraft client) {
        if (!config.hudEnabled) return;

        if (config.hudShowCoords && client.player != null) {
            LocalPlayer p = client.player;
            cachedCoords = String.format("%.1f, %.1f, %.1f", p.getX(), p.getY(), p.getZ());
        }
        if (config.hudShowFps) {
            cachedFps = client.getFps() + " fps";
        }
        if (config.hudShowPing && client.player != null && client.getConnection() != null) {
            PlayerInfo self = client.getConnection().getPlayerInfo(client.player.getUUID());
            // In singleplayer (or before the tab-list entry arrives) there's no meaningful latency
            // to show - drop the line instead of rendering a fake 0 ms.
            int latency = self != null ? self.getLatency() : 0;
            cachedPing = latency > 0 ? latency + " ms" : "";
        }
        if (config.hudShowDirection && client.player != null) {
            cachedDirection = "Facing: " + prettyDirection(client.player.getDirection().getName());
        }
    }

    public void render(GuiGraphics context, ModConfig config) {
        if (!config.hudEnabled) return;

        Minecraft client = Minecraft.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.font.lineHeight + 2;

        if (config.hudShowCoords && client.player != null) {
            context.drawString(client.font, cachedCoords, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (config.hudShowFps) {
            context.drawString(client.font, cachedFps, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (config.hudShowPing && !cachedPing.isEmpty()) {
            context.drawString(client.font, cachedPing, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (config.hudShowDirection && !cachedDirection.isEmpty()) {
            context.drawString(client.font, cachedDirection, x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (config.hudShowCps) {
            long window = client.getWindow().getWindow();
            cps.update(
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS,
                    GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS
            );
            context.drawString(client.font, cps.leftCps() + " | " + cps.rightCps() + " cps", x, y, TEXT_COLOR, true);
            y += lineHeight;
        }

        if (config.hudShowKeystrokes) {
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
