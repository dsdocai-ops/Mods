// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.features;

import com.omega.client.hud.CpsTracker;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import org.lwjgl.glfw.GLFW;

/**
 * Purely informational overlay state (coordinates / FPS / ping / facing / CPS / which
 * movement+attack keys are currently held). Nothing here reads data the player couldn't already
 * see through vanilla's own F3 debug screen or tab list - it's just a friendlier always-on subset
 * of it.
 *
 * This class only ever computes and caches plain data (String/boolean) - it deliberately never
 * takes or returns a Minecraft-mapped type as a public parameter. A render(GuiGraphics, ...) method
 * was tried here first and failed to compile on the Fabric side: at Fabric's compile time, common/'s
 * classes are seen through their *official*-mapped signatures (the `common` dependency configuration
 * gives the raw, unremapped compile-time view - only the final shadowJar-merged runtime artifact
 * goes through transformProductionFabric's remapping), so a method typed `GuiGraphics` there is a
 * different, unrelated type from Fabric's own `DrawContext`-typed HudRenderCallback parameter, even
 * though they're "the same" class once fully remapped at the bytecode level. FullbrightFeature/
 * FovZoomFeature/ToggleSprintFeature never hit this because their public signatures are already
 * primitives-only. The actual drawing (which genuinely needs a method-scoped, platform-native draw
 * context - there's no way to fetch one via a static call) stays a small per-loader wrapper in
 * OmegaClient.java / OmegaClientForge.java, reading the plain data cached here.
 */
public final class InfoHudFeature {
    public static final int TEXT_COLOR = 0xFFFFFF;
    public static final int SHADOW_BG = 0x66000000;
    public static final int KEY_BOX_SIZE = 18;
    public static final int KEY_BOX_GAP = 2;
    public static final String[] KEY_LABELS = {"W", "A", "S", "D", "SP", "LM"};

    private String cachedCoords = "";
    private String cachedFps = "";
    private String cachedPing = "";
    private String cachedDirection = "";
    private String cachedCps = "";
    private KeyMapping[] keyBindings;
    private final boolean[] keyHeld = new boolean[6];
    private final CpsTracker cps = new CpsTracker();

    public void tick(HudSettings settings) {
        if (!settings.enabled()) return;
        Minecraft client = Minecraft.getInstance();

        if (settings.showCoords() && client.player != null) {
            cachedCoords = String.format("%.1f, %.1f, %.1f", client.player.getX(), client.player.getY(), client.player.getZ());
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
        if (settings.showKeystrokes()) {
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
                keyHeld[i] = keyBindings[i].isDown();
            }
        }
    }

    /**
     * Must be called every frame (not just on the 20Hz tick) when showCps is on - clicks can be
     * shorter than a tick, and 20Hz sampling would undercount fast clickers (see CpsTracker).
     */
    public void pollCps() {
        Minecraft client = Minecraft.getInstance();
        long window = client.getWindow().getWindow();
        cps.update(
                GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS,
                GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS
        );
        cachedCps = cps.leftCps() + " | " + cps.rightCps() + " cps";
    }

    public String coords() {
        return cachedCoords;
    }

    public String fps() {
        return cachedFps;
    }

    public String ping() {
        return cachedPing;
    }

    public String direction() {
        return cachedDirection;
    }

    public String cpsText() {
        return cachedCps;
    }

    public boolean keyHeld(int index) {
        return keyHeld[index];
    }

    private static String prettyDirection(String name) {
        return name.isEmpty() ? name : Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }
}
