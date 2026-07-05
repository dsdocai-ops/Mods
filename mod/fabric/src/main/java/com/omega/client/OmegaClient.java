// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.omega.client.features.BlockHighlightFeature;
import com.omega.client.features.FovZoomFeature;
import com.omega.client.features.FullbrightFeature;
import com.omega.client.features.HudSettings;
import com.omega.client.features.InfoHudFeature;
import com.omega.client.features.ToggleSprintFeature;
import com.omega.client.network.PresenceNetworking;
import com.omega.client.schematic.SchematicRenderFeature;
import com.omega.client.schematic.SchematicSelection;
import com.omega.client.schematic.SchematicStorage;
import com.omega.client.session.SessionInfo;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
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
    /** Set once at startup - lets GameMenuScreenMixin (the Esc-menu Ω button) reach the same openMenu() the keybind uses, without a second config/session load. */
    public static OmegaClient INSTANCE;

    private final ModConfig config = ModConfig.load(FabricLoader.getInstance().getConfigDir());

    private final FullbrightFeature fullbright = new FullbrightFeature();
    private final FovZoomFeature fovZoom = new FovZoomFeature();
    private final ToggleSprintFeature toggleSprint = new ToggleSprintFeature();
    private final BlockHighlightFeature blockHighlight = new BlockHighlightFeature();
    private final InfoHudFeature infoHud = new InfoHudFeature();
    private final SchematicSelection schematicSelection = new SchematicSelection();
    private final SchematicRenderFeature schematicRender = new SchematicRenderFeature();
    private final SessionInfo session = SessionInfoLoader.load(FabricLoader.getInstance().getGameDir());

    // Refreshed once per tick (onClientTick), read every frame (renderHud) - avoids rebuilding
    // this record on every single render callback, which fires far more often than the tick loop.
    private HudSettings hudSettings = HudSettings.from(config);

    private KeyBinding menuKey;
    private KeyBinding zoomKey;
    private KeyBinding pos1Key;
    private KeyBinding pos2Key;
    private KeyBinding togglePreviewKey;
    private KeyBinding reanchorKey;

    @Override
    public void onInitializeClient() {
        SchematicStorage.init(FabricLoader.getInstance().getConfigDir());
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

        INSTANCE = this;
        PresenceNetworking.register(config);
        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> blockHighlight.render(context, config));
        WorldRenderEvents.AFTER_TRANSLUCENT.register(context -> schematicRender.render(context, config));
        HudRenderCallback.EVENT.register((drawContext, tickDelta) -> renderHud(drawContext));
    }

    /** Opens the same menu the "key.omega-client.menu" keybind does - shared with GameMenuScreenMixin's Esc-menu Ω button. */
    public void openMenu(MinecraftClient client) {
        client.setScreen(new ClickGuiScreen(config, schematicSelection, schematicRender, session));
    }

    private void onClientTick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            openMenu(client);
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
        hudSettings = HudSettings.from(config);
        infoHud.tick(hudSettings);

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

    // Drawing itself stays loader-specific - DrawContext (Yarn) and GuiGraphics (official, what
    // common/'s InfoHudFeature would need to take as a parameter) are different types at this
    // module's compile time even though they're the same class once fully remapped, so the actual
    // draw calls can't live in common/. See InfoHudFeature's javadoc for the full explanation. The
    // state behind these draws (cached strings, which keys are held) does live in common/ - this
    // method only reads it and calls DrawContext's own drawing methods.
    private void renderHud(DrawContext context) {
        HudSettings settings = hudSettings;
        if (!settings.enabled()) return;

        MinecraftClient client = MinecraftClient.getInstance();
        int x = 6;
        int y = 6;
        int lineHeight = client.textRenderer.fontHeight + 2;

        if (settings.showCoords() && client.player != null) {
            context.drawTextWithShadow(client.textRenderer, infoHud.coords(), x, y, InfoHudFeature.TEXT_COLOR);
            y += lineHeight;
        }
        if (settings.showFps()) {
            context.drawTextWithShadow(client.textRenderer, infoHud.fps(), x, y, InfoHudFeature.TEXT_COLOR);
            y += lineHeight;
        }
        if (settings.showPing() && !infoHud.ping().isEmpty()) {
            context.drawTextWithShadow(client.textRenderer, infoHud.ping(), x, y, InfoHudFeature.TEXT_COLOR);
            y += lineHeight;
        }
        if (settings.showDirection() && !infoHud.direction().isEmpty()) {
            context.drawTextWithShadow(client.textRenderer, infoHud.direction(), x, y, InfoHudFeature.TEXT_COLOR);
            y += lineHeight;
        }
        if (settings.showCps()) {
            infoHud.pollCps();
            context.drawTextWithShadow(client.textRenderer, infoHud.cpsText(), x, y, InfoHudFeature.TEXT_COLOR);
            y += lineHeight;
        }
        if (settings.showKeystrokes()) {
            renderKeystrokes(context, client, x, y);
        }
    }

    private void renderKeystrokes(DrawContext context, MinecraftClient client, int x, int y) {
        for (int i = 0; i < InfoHudFeature.KEY_LABELS.length; i++) {
            int keyX = x + i * (InfoHudFeature.KEY_BOX_SIZE + InfoHudFeature.KEY_BOX_GAP);
            boolean held = infoHud.keyHeld(i);
            int color = held ? 0xFF3B9CFF : InfoHudFeature.SHADOW_BG;
            context.fill(keyX, y, keyX + InfoHudFeature.KEY_BOX_SIZE, y + InfoHudFeature.KEY_BOX_SIZE, color);
            context.drawCenteredTextWithShadow(client.textRenderer, InfoHudFeature.KEY_LABELS[i], keyX + InfoHudFeature.KEY_BOX_SIZE / 2, y + InfoHudFeature.KEY_BOX_SIZE / 2 - 4, InfoHudFeature.TEXT_COLOR);
        }
    }
}
