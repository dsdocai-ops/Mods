// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.presence;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Which players are known to be running Omega Client, by UUID, and which cosmetics (if any) each one
 * is broadcasting - the source of truth behind the nametag badge and the worn cosmetics. Zero
 * Minecraft imports (same sharing rule as SchematicData/SessionInfo), plain concurrent map because
 * network callbacks and the render thread both touch it.
 *
 * A player wears up to one cosmetic per slot (hat/cape/wings) at once, so each entry is a CosmeticSet
 * rather than a single id. How entries get in here is deliberately decoupled: today it's the peer
 * presence channel (see each loader's PresenceNetworking - works where the server/proxy relays it,
 * silently dormant on plain vanilla servers). A future hosted presence API can feed this same map
 * without touching any rendering code.
 */
public final class OmegaPresence {
    /** The cosmetics a player is wearing, one id per slot ("" = nothing in that slot). */
    public record CosmeticSet(String hat, String cape, String wings) {
        public static final CosmeticSet EMPTY = new CosmeticSet("", "", "");

        public CosmeticSet {
            hat = hat != null ? hat : "";
            cape = cape != null ? cape : "";
            wings = wings != null ? wings : "";
        }

        public String forSlot(CosmeticCatalog.Slot slot) {
            return switch (slot) {
                case HAT -> hat;
                case CAPE -> cape;
                case WINGS -> wings;
            };
        }

        /** First non-empty in slot priority - the cosmetic whose color tints the Ω name badge. */
        public String primary() {
            if (!hat.isEmpty()) return hat;
            if (!cape.isEmpty()) return cape;
            return wings;
        }
    }

    private static final Map<UUID, CosmeticSet> USERS = new ConcurrentHashMap<>();

    private OmegaPresence() {
    }

    public static void add(UUID uuid, CosmeticSet set) {
        if (uuid != null) USERS.put(uuid, set != null ? set : CosmeticSet.EMPTY);
    }

    public static boolean isOmegaUser(UUID uuid) {
        return uuid != null && USERS.containsKey(uuid);
    }

    /** The cosmetics the player is wearing; EMPTY if they wear nothing or aren't a known Omega user. */
    public static CosmeticSet cosmeticsOf(UUID uuid) {
        if (uuid == null) return CosmeticSet.EMPTY;
        return USERS.getOrDefault(uuid, CosmeticSet.EMPTY);
    }

    /** Called on disconnect - presence is per-server-session. */
    public static void clear() {
        USERS.clear();
    }
}
