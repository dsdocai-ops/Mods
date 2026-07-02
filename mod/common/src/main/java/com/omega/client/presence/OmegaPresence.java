package com.omega.client.presence;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Which players are known to be running Omega Client, by UUID - the source of truth behind the
 * nametag badge. Zero Minecraft imports (same sharing rule as SchematicData/SessionInfo), plain
 * concurrent set because network callbacks and the render thread both touch it.
 *
 * How UUIDs get in here is deliberately decoupled: today it's the peer presence channel (see each
 * loader's PresenceNetworking - works where the server/proxy relays it, silently dormant on plain
 * vanilla servers, since without any server cooperation or a central backend one client physically
 * cannot know what another client is running). A future hosted presence API can feed this same set
 * without touching any rendering code.
 */
public final class OmegaPresence {
    private static final Set<UUID> USERS = ConcurrentHashMap.newKeySet();

    private OmegaPresence() {
    }

    public static void add(UUID uuid) {
        if (uuid != null) USERS.add(uuid);
    }

    public static boolean isOmegaUser(UUID uuid) {
        return uuid != null && USERS.contains(uuid);
    }

    /** Called on disconnect - presence is per-server-session. */
    public static void clear() {
        USERS.clear();
    }
}
