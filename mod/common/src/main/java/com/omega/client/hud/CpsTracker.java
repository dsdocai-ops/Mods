package com.omega.client.hud;

import java.util.ArrayDeque;

/**
 * Clicks-per-second counter for the info HUD. Loader code polls the raw GLFW mouse-button state
 * once per rendered frame and feeds it in here; this class does the edge detection and keeps a
 * one-second sliding window of press timestamps. Frame-rate polling (not the 20/s tick loop) is
 * deliberate: jitter/butterfly clicking produces presses shorter than a tick, and sampling at
 * 20 Hz would silently undercount exactly the players who care about a CPS display.
 *
 * Pure Java on purpose (no Minecraft classes) so both the Fabric and Forge modules share one
 * implementation - same rule as the rest of mod/common.
 */
public final class CpsTracker {
    private static final long WINDOW_MS = 1000L;

    private final ArrayDeque<Long> leftPresses = new ArrayDeque<>();
    private final ArrayDeque<Long> rightPresses = new ArrayDeque<>();
    private boolean leftWasDown;
    private boolean rightWasDown;

    /** Call once per frame with the current raw button state. */
    public void update(boolean leftDown, boolean rightDown) {
        long now = System.currentTimeMillis();
        if (leftDown && !leftWasDown) leftPresses.addLast(now);
        if (rightDown && !rightWasDown) rightPresses.addLast(now);
        leftWasDown = leftDown;
        rightWasDown = rightDown;
        prune(leftPresses, now);
        prune(rightPresses, now);
    }

    public int leftCps() {
        return leftPresses.size();
    }

    public int rightCps() {
        return rightPresses.size();
    }

    private static void prune(ArrayDeque<Long> presses, long now) {
        while (!presses.isEmpty() && now - presses.peekFirst() > WINDOW_MS) {
            presses.removeFirst();
        }
    }
}
