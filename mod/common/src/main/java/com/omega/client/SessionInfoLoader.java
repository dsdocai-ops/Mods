// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.google.gson.Gson;
import com.omega.client.session.SessionInfo;
import com.omega.client.util.OmegaGson;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Reads the session file the launcher writes into the game directory right before spawning the
 * game (see launch.ts's writeSessionInfo() / SESSION_FILE_NAME) so the in-game GUI can show which
 * account is active. Lives outside common/'s zero-Minecraft-import classes conceptually the same
 * way it always did (it needs Gson, same reasoning as SessionInfo's own javadoc), but the class
 * itself is now unified the same way ModConfig is: the game directory is resolved by each loader's
 * own entrypoint (FabricLoader.getInstance().getGameDir() vs FMLPaths.GAMEDIR.get()) and passed in,
 * since java.nio.file.Path has no Fabric/Forge-mapping divergence to work around.
 */
public final class SessionInfoLoader {
    private static final Gson GSON = OmegaGson.INSTANCE;
    private static Path gameDir;

    private SessionInfoLoader() {
    }

    public static SessionInfo load(Path gameDir) {
        SessionInfoLoader.gameDir = gameDir;
        Path path = gameDir.resolve(SessionInfo.FILE_NAME);
        if (!Files.exists(path)) {
            return new SessionInfo();
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            SessionInfo loaded = GSON.fromJson(reader, SessionInfo.class);
            return loaded != null ? loaded : new SessionInfo();
        } catch (IOException e) {
            return new SessionInfo();
        }
    }

    /** Signals the launcher to reopen its account switcher once the game has fully quit. */
    public static void requestAccountSwitch() {
        Path marker = gameDir.resolve(SessionInfo.SWITCH_ACCOUNT_MARKER_NAME);
        try {
            Files.write(marker, new byte[0]);
        } catch (IOException ignored) {
            // Non-fatal: worst case the launcher window just doesn't auto-pop the switcher.
        }
    }
}
