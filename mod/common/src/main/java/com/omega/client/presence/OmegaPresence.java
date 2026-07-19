// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Which players are known to be running Omega Client, by UUID, and which cosmetic (if any) each one
 * is broadcasting - the source of truth behind the nametag badge. Zero Minecraft imports (same
 * sharing rule as SchematicData/SessionInfo), plain concurrent map because network callbacks and the
 * render thread both touch it.
 *
 * How entries get in here is deliberately decoupled: today it's the peer presence channel (see each
 * loader's PresenceNetworking - works where the server/proxy relays it, silently dormant on plain
 * vanilla servers, since without any server cooperation or a central backend one client physically
 * cannot know what another client is running). A future hosted presence API can feed this same map
 * without touching any rendering code.
 */
public final class OmegaPresence {
    /** UUID -> cosmetic id ("" for "Omega user, no cosmetic" - see CosmeticCatalog). */
    private static final Map<UUID, String> USERS = new ConcurrentHashMap<>();

    private OmegaPresence() {
    }

    public static void add(UUID uuid, String cosmeticId) {
        if (uuid != null) USERS.put(uuid, cosmeticId != null ? cosmeticId : "");
    }

    public static boolean isOmegaUser(UUID uuid) {
        return uuid != null && USERS.containsKey(uuid);
    }

    /** Empty string if the player is an Omega user with no cosmetic; also empty if they're not known at all. */
    public static String cosmeticOf(UUID uuid) {
        if (uuid == null) return "";
        return USERS.getOrDefault(uuid, "");
    }

    /** Called on disconnect - presence is per-server-session. */
    public static void clear() {
        USERS.clear();
    }
}
