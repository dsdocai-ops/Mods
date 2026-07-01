package com.omega.client;

import com.omega.client.features.BlockHighlightFeature;
import com.omega.client.features.FovZoomFeature;
import com.omega.client.features.FullbrightFeature;
import com.omega.client.features.InfoHudFeature;
import com.omega.client.features.ToggleSprintFeature;
import com.omega.client.schematic.SchematicRenderFeature;
import com.omega.client.schematic.SchematicSelection;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import org.lwjgl.glfw.GLFW;

/**
 * Visual/QoL toggles for smoother, clearer PvP play - fullbright, depth-tested block highlighting,
 * custom FOV/zoom, toggle-sprint, an info HUD, and a schematic selection/preview tool. Deliberately
 * excludes anything that reads hidden information through terrain or automates combat input.
 */
public class OmegaClient implements ClientModInitializer {
    private final ModConfig config = ModConfig.load();

    private final FullbrightFeature fullbright = new FullbrightFeature();
    private final FovZoomFeature fovZoom = new FovZoomFeature();
    private final ToggleSprintFeature toggleSprint = new ToggleSprintFeature();
    private final BlockHighlightFeature blockHighlight = new BlockHighlightFeature();
    private final InfoHudFeature infoHud = new InfoHudFeature();
    private final SchematicSelection schematicSelection = new SchematicSelection();
    private final SchematicRenderFeature schematicRender = new SchematicRenderFeature();

    private KeyBinding menuKey;
    private KeyBinding zoomKey;
    private KeyBinding pos1Key;
    private KeyBinding pos2Key;
    private KeyBinding togglePreviewKey;
    private KeyBinding reanchorKey;

    @Override
    public void onInitializeClient() {
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.menu",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                "key.categories.omega-client"
        ));
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.zoom",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_C,
                "key.categories.omega-client"
        ));
        pos1Key = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.pos1",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_O,
                "key.categories.omega-client"
        ));
        pos2Key = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.pos2",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_P,
                "key.categories.omega-client"
        ));
        togglePreviewKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.toggle_preview",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_UNKNOWN,
                "key.categories.omega-client"
        ));
        reanchorKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.omega-client.reanchor",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_UNKNOWN,
                "key.categories.omega-client"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> blockHighlight.render(context, config));
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> schematicRender.render(context, config));
        HudRenderCallback.EVENT.register((drawContext, tickDelta) -> infoHud.render(drawContext, config));
    }

    private void onClientTick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            client.setScreen(new ClickGuiScreen(config, schematicSelection, schematicRender));
        }
        while (pos1Key.wasPressed()) {
            setSelectionFromCrosshair(client, true);
        }
        while (pos2Key.wasPressed()) {
            setSelectionFromCrosshair(client, false);
        }
        while (togglePreviewKey.wasPressed()) {
            config.schematicPreviewEnabled = !config.schematicPreviewEnabled;
            config.save();
        }
        while (reanchorKey.wasPressed()) {
            if (client.player != null) {
                schematicRender.setOrigin(client.player.getBlockPos());
            }
        }

        fullbright.tick(config);
        fovZoom.tick(config, zoomKey.isPressed());
        toggleSprint.tick(config);
        infoHud.tick(config, client);

        if (client.player != null && client.world != null) {
            blockHighlight.tick(config, client.world, client.player.getBlockPos());
        }
    }

    private void setSelectionFromCrosshair(MinecraftClient client, boolean isPos1) {
        if (!(client.crosshairTarget instanceof BlockHitResult blockHit)) return;
        BlockPos pos = blockHit.getBlockPos();
        if (isPos1) {
            schematicSelection.setPos1(pos);
        } else {
            schematicSelection.setPos2(pos);
        }
        if (client.player != null) {
            client.player.sendMessage(
                    Text.literal("Omega: Position " + (isPos1 ? "1" : "2") + " set to " + pos.getX() + ", " + pos.getY() + ", " + pos.getZ()),
                    true
            );
        }
    }
}
