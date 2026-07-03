package com.omega.client.forge.schematic;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;
import com.omega.client.schematic.SchematicData;
import net.minecraftforge.fml.loading.FMLPaths;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Forge-side twin of the Fabric SchematicStorage - identical logic, only the config-dir lookup differs (FMLPaths vs FabricLoader). Same file location/format, so files are interchangeable between the two builds. */
public final class SchematicStorage {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String EXTENSION = ".omschem.json";

    private SchematicStorage() {
    }

    public static Path schematicsDir() {
        Path dir = FMLPaths.CONFIGDIR.get().resolve("omega-client").resolve("schematics");
        try {
            Files.createDirectories(dir);
        } catch (IOException ignored) {
            // Best-effort; save() will surface the real error if the directory truly can't be created.
        }
        return dir;
    }

    /** Drop .litematic files here to have them show up as importable in the Schematics screen. */
    public static Path importDir() {
        Path dir = schematicsDir().resolve("import");
        try {
            Files.createDirectories(dir);
        } catch (IOException ignored) {
            // Best-effort; listLitematicFiles() just returns nothing if this truly doesn't exist.
        }
        return dir;
    }

    public static List<Path> listLitematicFiles() {
        List<Path> files = new ArrayList<>();
        try (var stream = Files.list(importDir())) {
            stream.filter(p -> p.getFileName().toString().toLowerCase().endsWith(".litematic")).forEach(files::add);
        } catch (IOException ignored) {
            // Import directory missing/unreadable - treat as nothing to import.
        }
        files.sort(Comparator.comparing(p -> p.getFileName().toString()));
        return files;
    }

    private static String sanitize(String name) {
        String cleaned = name.trim().replaceAll("[^a-zA-Z0-9_ -]", "_");
        return cleaned.isEmpty() ? "schematic" : cleaned;
    }

    private static Path fileFor(String name) {
        return schematicsDir().resolve(sanitize(name) + EXTENSION);
    }

    /**
     * Same fix as the Fabric twin: sanitize() collapses many distinct raw names onto the same
     * filename (every disallowed character becomes "_", most filesystems are also
     * case-insensitive), so saving under a name that only *looks* new after sanitizing would
     * otherwise silently truncate and overwrite a completely different saved schematic.
     * Re-saving the same schematic under its own name is still a normal in-place overwrite; only
     * a collision with a name that reads back as something *different* gets a numeric suffix.
     */
    private static Path resolveSaveTarget(String rawName) {
        Path candidate = fileFor(rawName);
        if (!Files.exists(candidate) || belongsToSameSchematic(candidate, rawName)) return candidate;

        int suffix = 2;
        Path disambiguated;
        do {
            disambiguated = schematicsDir().resolve(sanitize(rawName) + "_" + suffix + EXTENSION);
            suffix++;
        } while (Files.exists(disambiguated) && !belongsToSameSchematic(disambiguated, rawName));
        return disambiguated;
    }

    private static boolean belongsToSameSchematic(Path file, String rawName) {
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            SchematicData existing = GSON.fromJson(reader, SchematicData.class);
            return existing != null && rawName.equals(existing.name);
        } catch (IOException | JsonParseException e) {
            return false;
        }
    }

    public static void save(SchematicData data) throws IOException {
        Path file = resolveSaveTarget(data.name);
        // Write-then-atomic-rename, not a direct write - see the Fabric twin's comment for why
        // (a direct write truncates the real target immediately, so a crash mid-write permanently
        // destroys whatever good save was there before).
        Path tmp = file.resolveSibling(file.getFileName().toString() + ".tmp");
        try (Writer writer = Files.newBufferedWriter(tmp, StandardCharsets.UTF_8)) {
            GSON.toJson(data, writer);
        }
        try {
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public static SchematicData load(String name) throws IOException {
        Path file = fileFor(name);
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            SchematicData data;
            try {
                data = GSON.fromJson(reader, SchematicData.class);
            } catch (JsonParseException e) {
                // Unchecked - see the Fabric twin's comment for why this needs wrapping.
                throw new IOException("Schematic file is corrupted: " + file, e);
            }
            if (data == null) throw new IOException("Schematic file is empty or invalid: " + file);
            // Gson overrides the field default with null if a hand-edited file explicitly contains
            // "blocks": null - and the ghost renderer iterates this list every frame.
            if (data.blocks == null) data.blocks = new java.util.ArrayList<>();
            return data;
        }
    }

    public static void delete(String name) {
        try {
            Files.deleteIfExists(fileFor(name));
        } catch (IOException ignored) {
            // Best-effort delete; a stuck file just means it'll still show up in listNames().
        }
    }

    public static List<String> listNames() {
        List<String> names = new ArrayList<>();
        try (var stream = Files.list(schematicsDir())) {
            stream.filter(p -> p.getFileName().toString().endsWith(EXTENSION))
                    .forEach(p -> {
                        String fileName = p.getFileName().toString();
                        names.add(fileName.substring(0, fileName.length() - EXTENSION.length()));
                    });
        } catch (IOException ignored) {
            // Directory missing/unreadable - treat as no saved schematics.
        }
        names.sort(Comparator.naturalOrder());
        return names;
    }
}
