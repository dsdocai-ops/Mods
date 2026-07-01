package com.omega.client;

import com.google.gson.Gson;
import com.omega.client.session.SessionInfo;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Reads the session file the launcher writes into the game directory right before spawning the
 * game (see launch.ts's writeSessionInfo() / SESSION_FILE_NAME) so the in-game GUI can show which
 * account is active. Lives outside common/ because it needs Gson, which common/ deliberately
 * doesn't depend on - see SessionInfo's javadoc.
 */
public final class SessionInfoLoader {
    private static final Gson GSON = new Gson();

    private SessionInfoLoader() {
    }

    public static SessionInfo load() {
        Path path = FabricLoader.getInstance().getGameDir().resolve(SessionInfo.FILE_NAME);
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
        Path marker = FabricLoader.getInstance().getGameDir().resolve(SessionInfo.SWITCH_ACCOUNT_MARKER_NAME);
        try {
            Files.write(marker, new byte[0]);
        } catch (IOException ignored) {
            // Non-fatal: worst case the launcher window just doesn't auto-pop the switcher.
        }
    }
}
