package com.omega.client.forge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraftforge.fml.loading.FMLPaths;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Forge-side twin of the Fabric module's ModConfig - same fields/shape (so the launcher's generic
 * mod-config editor works identically either way), same file name, different config-dir lookup
 * (FMLPaths.CONFIGDIR instead of FabricLoader.getInstance().getConfigDir()).
 */
public class ModConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String FILE_NAME = "omega-client.json";

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

    public boolean schematicPreviewEnabled = false;

    private static Path configPath() {
        return FMLPaths.CONFIGDIR.get().resolve(FILE_NAME);
    }

    public static ModConfig load() {
        Path path = configPath();
        if (!Files.exists(path)) {
            ModConfig fresh = new ModConfig();
            fresh.save();
            return fresh;
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            ModConfig loaded = GSON.fromJson(reader, ModConfig.class);
            return loaded != null ? loaded : new ModConfig();
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
