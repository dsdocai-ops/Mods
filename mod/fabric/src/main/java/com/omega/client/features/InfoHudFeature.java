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
 *
 * The coordinate/FPS text is recomputed on the 20/s tick loop and cached, not on every render()
 * call - render() can fire well over 20 times a second (uncapped or high-refresh-rate displays,
 * exactly the setup competitive PvP players tend to run), so formatting a fresh string there was
 * needless GC churn every single frame for numbers that only meaningfully change 20 times a second.
 */
public final class InfoHudFeature {
    private static final int TEXT_COLOR = 0xFFFFFF;
    private static final int SHADOW_BG = 0x66000000;
    private static final int KEY_BOX_SIZE = 18;
    private static final int KEY_BOX_GAP = 2;
    private static final String[] KEY_LABELS = {"W", "A", "S", "D", "SP", "LM"};

    private String cachedCoords = "";
    private String cachedFps = "";
    private KeyBinding[] keyBindings;

    public void tick(ModConfig config, MinecraftClient client) {
        if (!config.hudEnabled) return;

        if (config.hudShowCoords && client.player != null) {
            ClientPlayerEntity p = client.player;
            cachedCoords = String.format("%.1f, %.1f, %.1f", p.getX(), p.getY(), p.getZ());
        }
        if (config.hudShowFps) {
            cachedFps = client.getCurrentFps() + " fps";
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

        if (config.hudShowKeystrokes) {
            renderKeystrokes(context, client, x, y);
        }
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
