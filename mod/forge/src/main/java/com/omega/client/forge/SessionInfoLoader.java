package com.omega.client.forge;

import com.google.gson.Gson;
import com.omega.client.session.SessionInfo;
import net.minecraftforge.fml.loading.FMLPaths;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Forge-side twin of the Fabric module's SessionInfoLoader - same logic, different game-dir lookup
 * (FMLPaths.GAMEDIR instead of FabricLoader.getInstance().getGameDir()), matching the same pattern
 * already used by this module's own ModConfig.
 */
public final class SessionInfoLoader {
    private static final Gson GSON = new Gson();

    private SessionInfoLoader() {
    }

    public static SessionInfo load() {
        Path path = FMLPaths.GAMEDIR.get().resolve(SessionInfo.FILE_NAME);
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
        Path marker = FMLPaths.GAMEDIR.get().resolve(SessionInfo.SWITCH_ACCOUNT_MARKER_NAME);
        try {
            Files.write(marker, new byte[0]);
        } catch (IOException ignored) {
            // Non-fatal: worst case the launcher window just doesn't auto-pop the switcher.
        }
    }
}
