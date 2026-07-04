// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.session;

/**
 * Mirrors the JSON the launcher writes (omega-client-session.json, in the game's working
 * directory) right before spawning the game - see launch.ts's writeSessionInfo(). Plain data only,
 * zero Minecraft imports, same reason SchematicData/SchematicBlockEntry live here: safe to
 * genuinely share between the Fabric and Forge modules. Each loader module has its own small
 * SessionInfoLoader that deserializes this with its own already-available Gson, since common/ has
 * no dependencies of its own.
 */
public class SessionInfo {
    /** Must match SESSION_FILE_NAME in launch.ts exactly. */
    public static final String FILE_NAME = "omega-client-session.json";
    /** Must match SWITCH_ACCOUNT_MARKER_NAME in launch.ts exactly. */
    public static final String SWITCH_ACCOUNT_MARKER_NAME = "omega-client-switch-account.request";

    public String accountType = "offline";
    public String username = "Player";
    public String uuid = "";
}
