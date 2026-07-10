// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import com.mojang.blaze3d.platform.InputConstants;
import com.omega.client.ModConfig;
import com.omega.client.SessionInfoLoader;
import com.omega.client.features.FovZoomFeature;
import com.omega.client.features.FullbrightFeature;
import com.omega.client.features.HudSettings;
import com.omega.client.features.InfoHudFeature;
import com.omega.client.features.ToggleSprintFeature;
import com.omega.client.forge.features.BlockHighlightFeature;
import com.omega.client.forge.features.HatRenderer;
import com.omega.client.forge.network.PresenceNetworking;
import com.omega.client.forge.schematic.SchematicRenderFeature;
import com.omega.client.forge.schematic.SchematicSelection;
import com.omega.client.schematic.SchematicStorage;
import com.omega.client.session.SessionInfo;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
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
import net.minecraftforge.fml.loading.FMLPaths;
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
    /** Set once at startup - lets PauseScreenMixin (the Esc-menu Ω button) reach the same openMenu() the keybind uses, without a second config/session load. */
    public static OmegaClientForge INSTANCE;

    private final ModConfig config = ModConfig.load(FMLPaths.CONFIGDIR.get());

    private final FullbrightFeature fullbright = new FullbrightFeature();
    private final FovZoomFeature fovZoom = new FovZoomFeature();
    private final ToggleSprintFeature toggleSprint = new ToggleSprintFeature();
    private final BlockHighlightFeature blockHighlight = new BlockHighlightFeature();
    private final HatRenderer hatRenderer = new HatRenderer();
    private final InfoHudFeature infoHud = new InfoHudFeature();
    private final SchematicSelection schematicSelection = new SchematicSelection();
    private final SchematicRenderFeature schematicRender = new SchematicRenderFeature();
    private final SessionInfo session = SessionInfoLoader.load(FMLPaths.GAMEDIR.get());

    // Refreshed once per tick (onClientTick), read every frame (renderHud) - avoids rebuilding
    // this record on every single render callback, which fires far more often than the tick loop.
    private HudSettings hudSettings = HudSettings.from(config);

    private final KeyMapping menuKey = new KeyMapping("key.omega-client.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "key.categories.omega-client");
    private final KeyMapping zoomKey = new KeyMapping("key.omega-client.zoom", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_C, "key.categories.omega-client");
    private final KeyMapping pos1Key = new KeyMapping("key.omega-client.pos1", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_O, "key.categories.omega-client");
    private final KeyMapping pos2Key = new KeyMapping("key.omega-client.pos2", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_P, "key.categories.omega-client");
    private final KeyMapping togglePreviewKey = new KeyMapping("key.omega-client.toggle_preview", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "key.categories.omega-client");
    private final KeyMapping reanchorKey = new KeyMapping("key.omega-client.reanchor", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "key.categories.omega-client");

    public OmegaClientForge() {
        INSTANCE = this;
        SchematicStorage.init(FMLPaths.CONFIGDIR.get());
        IEventBus modEventBus = FMLJavaModLoadingContext.get().getModEventBus();
        modEventBus.addListener(this::onRegisterKeyMappings);
        modEventBus.addListener(this::onRegisterGuiOverlays);
        MinecraftForge.EVENT_BUS.register(this);
        PresenceNetworking.register(config);
    }

    /** Opens the same menu the "key.omega-client.menu" keybind does - shared with PauseScreenMixin's Esc-menu Ω button. */
    public void openMenu(Minecraft client) {
        client.setScreen(new ClickGuiScreen(config, schematicSelection, schematicRender, session));
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
        event.registerAboveAll("omega_hud", (gui, guiGraphics, partialTick, width, height) -> renderHud(guiGraphics));
    }

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;

        Minecraft client = Minecraft.getInstance();

        while (menuKey.consumeClick()) {
            openMenu(client);
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
        hudSettings = HudSettings.from(config);
        infoHud.tick(hudSettings);

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
        hatRenderer.render(event.getPoseStack(), buffers, camPos, event.getPartialTick(), config);
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

    // Drawing itself stays loader-specific - GuiGraphics (official) and Fabric's DrawContext (Yarn)
    // are different types at each module's own compile time even though they're the same class once
    // fully remapped, so the actual draw calls can't live in common/. See InfoHudFeature's javadoc
    // for the full explanation. The state behind these draws (cached strings, which keys are held)
    // does live in common/ - this method only reads it and calls GuiGraphics's own drawing methods.
    private void renderHud(GuiGraphics context) {
        HudSettings settings = hudSettings;
        if (!settings.enabled()) return;

        Minecraft client = Minecraft.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.font.lineHeight + 2;

        if (settings.showCoords() && client.player != null) {
            context.drawString(client.font, infoHud.coords(), x, y, InfoHudFeature.TEXT_COLOR, true);
            y += lineHeight;
        }
        if (settings.showFps()) {
            context.drawString(client.font, infoHud.fps(), x, y, InfoHudFeature.TEXT_COLOR, true);
            y += lineHeight;
        }
        if (settings.showPing() && !infoHud.ping().isEmpty()) {
            context.drawString(client.font, infoHud.ping(), x, y, InfoHudFeature.TEXT_COLOR, true);
            y += lineHeight;
        }
        if (settings.showDirection() && !infoHud.direction().isEmpty()) {
            context.drawString(client.font, infoHud.direction(), x, y, InfoHudFeature.TEXT_COLOR, true);
            y += lineHeight;
        }
        if (settings.showCps()) {
            infoHud.pollCps();
            context.drawString(client.font, infoHud.cpsText(), x, y, InfoHudFeature.TEXT_COLOR, true);
            y += lineHeight;
        }
        if (settings.showKeystrokes()) {
            renderKeystrokes(context, client, x, y);
        }
    }

    private void renderKeystrokes(GuiGraphics context, Minecraft client, int x, int y) {
        for (int i = 0; i < InfoHudFeature.KEY_LABELS.length; i++) {
            int keyX = x + i * (InfoHudFeature.KEY_BOX_SIZE + InfoHudFeature.KEY_BOX_GAP);
            boolean held = infoHud.keyHeld(i);
            int color = held ? 0xFF3B9CFF : InfoHudFeature.SHADOW_BG;
            context.fill(keyX, y, keyX + InfoHudFeature.KEY_BOX_SIZE, y + InfoHudFeature.KEY_BOX_SIZE, color);
            context.drawCenteredString(client.font, InfoHudFeature.KEY_LABELS[i], keyX + InfoHudFeature.KEY_BOX_SIZE / 2, y + InfoHudFeature.KEY_BOX_SIZE / 2 - 4, InfoHudFeature.TEXT_COLOR);
        }
    }
}
