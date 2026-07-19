// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import com.google.gson.Gson;
import com.omega.client.util.OmegaGson;

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
 *
 * Unified into common/ (was previously duplicated per loader) - the only thing that ever differed
 * was how the config directory gets resolved (FabricLoader.getInstance().getConfigDir() vs
 * FMLPaths.CONFIGDIR.get()), and since java.nio.file.Path is a plain JDK type with no
 * Fabric/Forge-mapping divergence, that resolution can just happen in each loader's own entrypoint
 * and get passed in to load() - no need for the loader-specific ModConfig duplication every other
 * feature class had to decouple from.
 */
public class ModConfig {
    private static final Gson GSON = OmegaGson.INSTANCE;
    private static final String FILE_NAME = "omega-client.json";
    private static Path configDir;

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

    /**
     * Whether the launcher applies its low-latency G1GC ("smooth PvP") JVM tuning when starting this
     * instance. Toggled from the in-game Omega menu like every other setting, but unlike the rest it
     * takes effect on the *next* launch, not live: JVM garbage-collector flags are fixed when the JVM
     * starts and can't change while the game is running. The launcher reads this field from
     * config/omega-client.json before spawning Java - see launch.ts's readSmoothPvpPreference.
     */
    public boolean smoothPvpEnabled = true;

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
    /** Empty = no cosmetic selected. Defaults to whatever the launcher's Cosmetics redeem flow last set, but is also switchable in-game via the menu's Cosmetics... screen; see CosmeticCatalog. */
    public String ownedCosmeticId = "";

    /**
     * Cosmetic *visibility* toggles - separate from the Ω badge (showOmegaUsersEnabled above, which
     * only gates the nametag prefix and your own presence broadcast) and from which cosmetic is
     * equipped (ownedCosmeticId above). These only decide what CosmeticFeatureRenderer/
     * CosmeticRenderLayer draw for whoever's already broadcasting a cosmetic; same master+per-
     * category shape as the particle toggles below. Both self and others start enabled so this is
     * purely opt-out.
     */
    public boolean cosmeticsMasterEnabled = true;
    /** Whether your own worn cosmetic renders (e.g. visible to yourself in third-person). */
    public boolean showOwnCosmeticsEnabled = true;
    /** Whether other players' worn cosmetics render on your screen. */
    public boolean showOthersCosmeticsEnabled = true;
    public boolean hatCosmeticsEnabled = true;
    public boolean capeCosmeticsEnabled = true;
    public boolean wingsCosmeticsEnabled = true;

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
        return configDir.resolve(FILE_NAME);
    }

    public static ModConfig load(Path configDir) {
        ModConfig.configDir = configDir;
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
            // a null would crash the game instead of just misbehaving. highlightColorArgb is the
            // same story despite not being a list: BlockHighlightFeature.resolveColor() calls
            // argb.equals(...) on it unconditionally every frame the feature is on.
            if (loaded.highlightedBlocks == null) loaded.highlightedBlocks = new ArrayList<>();
            if (loaded.particleBlacklist == null) loaded.particleBlacklist = new ArrayList<>();
            if (loaded.highlightColorArgb == null) loaded.highlightColorArgb = "#803B9CFF";
            if (loaded.ownedCosmeticId == null) loaded.ownedCosmeticId = "";
            // A value outside the slider's intended 0.0-1.0 range (e.g. hand-edited, or typed into
            // the launcher's generic number input which has no range constraint) makes the density
            // check in ParticleFilter.shouldSpawn silently drop every particle regardless of the
            // category toggles' still-ON state - clamp once here instead of at every call site.
            if (loaded.particleDensity < 0f) loaded.particleDensity = 0f;
            if (loaded.particleDensity > 1f) loaded.particleDensity = 1f;
            return loaded;
        } catch (IOException | RuntimeException e) {
            // RuntimeException covers Gson's own parse failures (JsonSyntaxException,
            // NumberFormatException, etc.) - a field of the wrong JSON type (a float typed into an
            // int field, a boolean typed into a string-list field) throws one of these, not
            // IOException, and previously propagated straight out of load(), which runs as a field
            // initializer in the mod's entrypoint - failing the whole mod's init over one bad field.
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
