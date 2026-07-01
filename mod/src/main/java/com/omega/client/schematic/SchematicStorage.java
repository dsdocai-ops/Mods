package com.omega.client.schematic;

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
import java.util.Comparator;
import java.util.List;

/** Save/load/list/delete for .omschem.json files under <config>/omega-client/schematics/. */
public final class SchematicStorage {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String EXTENSION = ".omschem.json";

    private SchematicStorage() {
    }

    public static Path schematicsDir() {
        Path dir = FabricLoader.getInstance().getConfigDir().resolve("omega-client").resolve("schematics");
        try {
            Files.createDirectories(dir);
        } catch (IOException ignored) {
            // Best-effort; save() will surface the real error if the directory truly can't be created.
        }
        return dir;
    }

    private static String sanitize(String name) {
        String cleaned = name.trim().replaceAll("[^a-zA-Z0-9_ -]", "_");
        return cleaned.isEmpty() ? "schematic" : cleaned;
    }

    private static Path fileFor(String name) {
        return schematicsDir().resolve(sanitize(name) + EXTENSION);
    }

    public static void save(SchematicData data) throws IOException {
        Path file = fileFor(data.name);
        try (Writer writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8)) {
            GSON.toJson(data, writer);
        }
    }

    public static SchematicData load(String name) throws IOException {
        Path file = fileFor(name);
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            SchematicData data = GSON.fromJson(reader, SchematicData.class);
            if (data == null) throw new IOException("Schematic file is empty or invalid: " + file);
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
