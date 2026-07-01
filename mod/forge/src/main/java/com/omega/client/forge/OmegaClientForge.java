package com.omega.client.forge;

import com.mojang.blaze3d.platform.InputConstants;
import com.omega.client.forge.features.BlockHighlightFeature;
import com.omega.client.forge.features.FovZoomFeature;
import com.omega.client.forge.features.FullbrightFeature;
import com.omega.client.forge.features.InfoHudFeature;
import com.omega.client.forge.features.ToggleSprintFeature;
import com.omega.client.forge.schematic.SchematicRenderFeature;
import com.omega.client.forge.schematic.SchematicSelection;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraftforge.client.event.RegisterGuiOverlaysEvent;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraftforge.client.event.RegisterKeyMappingsEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.lwjgl.glfw.GLFW;

/**
 * Forge entrypoint - the Forge-bus/mod-bus equivalent of the Fabric module's OmegaClient
 * (ClientModInitializer + KeyBindingHelper + ClientTickEvents + WorldRenderEvents +
 * HudRenderCallback). Same feature set, same "no automation, no reveal-through-walls" scope.
 *
 * The event wiring here (RegisterKeyMappingsEvent, RegisterGuiOverlaysEvent,
 * RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS, TickEvent.ClientTickEvent) is the part of
 * this whole Forge module I'd check first if something doesn't compile - Forge's client rendering
 * and HUD-overlay APIs changed shape more than once across the 1.20.x line, so the exact event
 * class names and registration methods below are a genuine guess, lower confidence than the
 * class/method renames elsewhere in this module. See mod/README.md.
 */
@Mod("omega_client_forge")
public class OmegaClientForge {
    private final ModConfig config = ModConfig.load();

    private final FullbrightFeature fullbright = new FullbrightFeature();
    private final FovZoomFeature fovZoom = new FovZoomFeature();
    private final ToggleSprintFeature toggleSprint = new ToggleSprintFeature();
    private final BlockHighlightFeature blockHighlight = new BlockHighlightFeature();
    private final InfoHudFeature infoHud = new InfoHudFeature();
    private final SchematicSelection schematicSelection = new SchematicSelection();
    private final SchematicRenderFeature schematicRender = new SchematicRenderFeature();

    private final KeyMapping menuKey = new KeyMapping("key.omega-client.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "key.categories.omega-client");
    private final KeyMapping zoomKey = new KeyMapping("key.omega-client.zoom", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_C, "key.categories.omega-client");
    private final KeyMapping pos1Key = new KeyMapping("key.omega-client.pos1", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_O, "key.categories.omega-client");
    private final KeyMapping pos2Key = new KeyMapping("key.omega-client.pos2", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_P, "key.categories.omega-client");
    private final KeyMapping togglePreviewKey = new KeyMapping("key.omega-client.toggle_preview", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "key.categories.omega-client");
    private final KeyMapping reanchorKey = new KeyMapping("key.omega-client.reanchor", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "key.categories.omega-client");

    public OmegaClientForge() {
        IEventBus modEventBus = FMLJavaModLoadingContext.get().getModEventBus();
        modEventBus.addListener(this::onRegisterKeyMappings);
        modEventBus.addListener(this::onRegisterGuiOverlays);
        MinecraftForge.EVENT_BUS.register(this);
    }

    private void onRegisterKeyMappings(RegisterKeyMappingsEvent event) {
        event.register(menuKey);
        event.register(zoomKey);
        event.register(pos1Key);
        event.register(pos2Key);
        event.register(togglePreviewKey);
        event.register(reanchorKey);
    }

    private void onRegisterGuiOverlays(RegisterGuiOverlaysEvent event) {
        event.registerAboveAll("omega_hud", (gui, guiGraphics, partialTick, width, height) -> infoHud.render(guiGraphics, config));
    }

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;

        Minecraft client = Minecraft.getInstance();

        while (menuKey.consumeClick()) {
            client.setScreen(new ClickGuiScreen(config, schematicSelection, schematicRender));
        }
        while (pos1Key.consumeClick()) {
            setSelectionFromCrosshair(client, true);
        }
        while (pos2Key.consumeClick()) {
            setSelectionFromCrosshair(client, false);
        }
        while (togglePreviewKey.consumeClick()) {
            config.schematicPreviewEnabled = !config.schematicPreviewEnabled;
            config.save();
        }
        while (reanchorKey.consumeClick()) {
            if (client.player != null) {
                schematicRender.setOrigin(client.player.blockPosition());
            }
        }

        fullbright.tick(config);
        fovZoom.tick(config, zoomKey.isDown());
        toggleSprint.tick(config);
        infoHud.tick(config, client);

        if (client.player != null && client.level != null) {
            blockHighlight.tick(config, client.level, client.player.blockPosition());
        }
    }

    @SubscribeEvent
    public void onRenderLevel(RenderLevelStageEvent event) {
        if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS) return;

        Minecraft client = Minecraft.getInstance();
        var buffers = client.renderBuffers().bufferSource();
        var camPos = event.getCamera().getPosition();

        blockHighlight.render(event.getPoseStack(), buffers, camPos, config);
        schematicRender.render(event.getPoseStack(), buffers, camPos, config);
    }

    private void setSelectionFromCrosshair(Minecraft client, boolean isPos1) {
        if (!(client.hitResult instanceof BlockHitResult blockHit)) return;
        BlockPos pos = blockHit.getBlockPos();
        if (isPos1) {
            schematicSelection.setPos1(pos);
        } else {
            schematicSelection.setPos2(pos);
        }
        LocalPlayer player = client.player;
        if (player != null) {
            // displayClientMessage(Component, boolean) is the official-mappings equivalent of the
            // Fabric side's sendMessage(Text, boolean) - same moderate-confidence spot, see
            // mod/README.md.
            player.displayClientMessage(
                    Component.literal("Omega: Position " + (isPos1 ? "1" : "2") + " set to " + pos.getX() + ", " + pos.getY() + ", " + pos.getZ()),
                    true
            );
        }
    }
}
