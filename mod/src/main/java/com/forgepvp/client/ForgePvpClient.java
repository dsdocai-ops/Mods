package com.forgepvp.client;

import com.forgepvp.client.features.BlockHighlightFeature;
import com.forgepvp.client.features.FovZoomFeature;
import com.forgepvp.client.features.FullbrightFeature;
import com.forgepvp.client.features.InfoHudFeature;
import com.forgepvp.client.features.ToggleSprintFeature;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/**
 * Visual/QoL toggles for smoother, clearer PvP play - fullbright, depth-tested block highlighting,
 * custom FOV/zoom, toggle-sprint, and an info HUD. Deliberately excludes anything that reads hidden
 * information through terrain or automates combat input.
 */
public class ForgePvpClient implements ClientModInitializer {
    private final ModConfig config = ModConfig.load();

    private final FullbrightFeature fullbright = new FullbrightFeature();
    private final FovZoomFeature fovZoom = new FovZoomFeature();
    private final ToggleSprintFeature toggleSprint = new ToggleSprintFeature();
    private final BlockHighlightFeature blockHighlight = new BlockHighlightFeature();
    private final InfoHudFeature infoHud = new InfoHudFeature();

    private KeyBinding menuKey;
    private KeyBinding zoomKey;

    @Override
    public void onInitializeClient() {
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.forgepvp-client.menu",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                "key.categories.forgepvp-client"
        ));
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.forgepvp-client.zoom",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_C,
                "key.categories.forgepvp-client"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> blockHighlight.render(context, config));
        HudRenderCallback.EVENT.register((drawContext, tickDelta) -> infoHud.render(drawContext, config));
    }

    private void onClientTick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            client.setScreen(new ClickGuiScreen(config));
        }

        fullbright.tick(config);
        fovZoom.tick(config, zoomKey.isPressed());
        toggleSprint.tick(config);

        if (client.player != null && client.world != null) {
            blockHighlight.tick(config, client.world, client.player.getBlockPos());
        }
    }
}
