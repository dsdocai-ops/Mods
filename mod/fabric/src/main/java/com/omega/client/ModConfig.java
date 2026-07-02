package com.omega.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Plain-JSON config, deliberately readable/editable both in-game and by the Omega Client launcher's
 * generic mod-config editor (which infers a form from whatever fields it finds here).
 */
public class ModConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String FILE_NAME = "omega-client.json";

    /** The instance the particle Mixin reads from - set whenever load() runs. See ParticleFilter. */
    public static ModConfig ACTIVE = new ModConfig();

    public boolean fullbrightEnabled = false;

    public boolean blockHighlightEnabled = false;
    public List<String> highlightedBlocks = new ArrayList<>(List.of(
            "minecraft:obsidian",
            "minecraft:respawn_anchor",
            "minecraft:crying_obsidian"
    ));
    public String highlightColorArgb = "#803B9CFF";

    public boolean customFovEnabled = false;
    public int customFov = 90;
    public int zoomFov = 30;

    public boolean toggleSprintEnabled = false;

    public boolean hudEnabled = true;
    public boolean hudShowCoords = true;
    public boolean hudShowFps = true;
    public boolean hudShowKeystrokes = true;
    public boolean hudShowPing = true;
    public boolean hudShowDirection = true;
    /** Off by default - a CPS readout is a PvP-niche stat most players don't want on screen. */
    public boolean hudShowCps = false;

    /** Suppress the camera tilt/shake when taking damage. */
    public boolean noHurtCamEnabled = false;
    /** Push the fog planes out to infinity - terrain, water and nether fog alike. */
    public boolean noFogEnabled = false;
    /** Client-visual only: render (and hear) clear skies even while the server says rain/thunder. */
    public boolean clearWeatherEnabled = false;

    public boolean schematicPreviewEnabled = false;

    /** Show an Omega badge next to the nametag of players known to be on Omega Client. */
    public boolean showOmegaUsersEnabled = true;

    public boolean particlesMasterEnabled = true;
    public boolean blockParticlesEnabled = true;
    public boolean ambientParticlesEnabled = true;
    public boolean totemParticlesEnabled = true;
    public boolean critParticlesEnabled = true;
    public boolean explosionParticlesEnabled = true;
    public boolean portalParticlesEnabled = true;
    /** Extra particle type ids to always block, e.g. "minecraft:soul" - on top of the category toggles above. */
    public List<String> particleBlacklist = new ArrayList<>();
    /** Chance (0.0-1.0) that a particle otherwise allowed through actually spawns - a global thinning slider. */
    public float particleDensity = 1.0f;

    private static Path configPath() {
        return FabricLoader.getInstance().getConfigDir().resolve(FILE_NAME);
    }

    public static ModConfig load() {
        ModConfig result = loadFromDisk();
        ACTIVE = result;
        return result;
    }

    private static ModConfig loadFromDisk() {
        Path path = configPath();
        if (!Files.exists(path)) {
            ModConfig fresh = new ModConfig();
            fresh.save();
            return fresh;
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            ModConfig loaded = GSON.fromJson(reader, ModConfig.class);
            if (loaded == null) return new ModConfig();
            // Gson overrides field defaults with null when the JSON explicitly contains null (a
            // hand-edit, or a bad save through the launcher's generic config editor) - and these
            // lists get iterated on hot paths (every particle spawn / every highlight scan), where
            // a null would crash the game instead of just misbehaving.
            if (loaded.highlightedBlocks == null) loaded.highlightedBlocks = new ArrayList<>();
            if (loaded.particleBlacklist == null) loaded.particleBlacklist = new ArrayList<>();
            return loaded;
        } catch (IOException e) {
            return new ModConfig();
        }
    }

    public void save() {
        Path path = configPath();
        try {
            Files.createDirectories(path.getParent());
            try (Writer writer = Files.newBufferedWriter(path, StandardCharsets.UTF_8)) {
                GSON.toJson(this, writer);
            }
        } catch (IOException ignored) {
            // Non-fatal: worst case the next in-game change simply doesn't persist to disk.
        }
    }
}
