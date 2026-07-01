package com.omega.client.features;

import com.omega.client.ModConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.option.KeyBinding;

/**
 * Purely informational overlay (coordinates / FPS / which movement+attack keys are currently held).
 * Nothing here reads data the player couldn't already see through vanilla's own F3 debug screen -
 * it's just a friendlier always-on subset of it.
 */
public final class InfoHudFeature {
    private static final int TEXT_COLOR = 0xFFFFFF;
    private static final int SHADOW_BG = 0x66000000;

    public void render(DrawContext context, ModConfig config) {
        if (!config.hudEnabled) return;

        MinecraftClient client = MinecraftClient.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.textRenderer.fontHeight + 2;

        if (config.hudShowCoords && client.player != null) {
            ClientPlayerEntity p = client.player;
            String coords = String.format("%.1f, %.1f, %.1f", p.getX(), p.getY(), p.getZ());
            context.drawTextWithShadow(client.textRenderer, coords, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowFps) {
            String fps = client.getCurrentFps() + " fps";
            context.drawTextWithShadow(client.textRenderer, fps, x, y, TEXT_COLOR);
            y += lineHeight;
        }

        if (config.hudShowKeystrokes) {
            renderKeystrokes(context, client, x, y);
        }
    }

    private void renderKeystrokes(DrawContext context, MinecraftClient client, int x, int y) {
        int box = 18;
        int gap = 2;
        KeyBinding[] keys = {
                client.options.forwardKey,
                client.options.leftKey,
                client.options.backKey,
                client.options.rightKey,
                client.options.jumpKey,
                client.options.attackKey,
        };
        String[] labels = {"W", "A", "S", "D", "SP", "LM"};

        for (int i = 0; i < keys.length; i++) {
            int keyX = x + i * (box + gap);
            boolean held = keys[i].isPressed();
            int color = held ? 0xFF3B9CFF : SHADOW_BG;
            context.fill(keyX, y, keyX + box, y + box, color);
            context.drawCenteredTextWithShadow(client.textRenderer, labels[i], keyX + box / 2, y + box / 2 - 4, TEXT_COLOR);
        }
    }
}
