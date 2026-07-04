// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/**
 * The single Gson instance for every JSON file this mod reads or writes (ModConfig, SchematicStorage,
 * SessionInfoLoader) - previously each of those constructed its own instance independently, one of
 * which (SessionInfoLoader, read-only) omitted pretty-printing while the other two enabled it.
 * Pretty-printing has no effect on reads, so sharing one instance costs nothing for the read-only
 * caller and removes the inconsistency for anything that also writes.
 */
public final class OmegaGson {
    public static final Gson INSTANCE = new GsonBuilder().setPrettyPrinting().create();

    private OmegaGson() {
    }
}
