// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { Client } from "@xhayper/discord-rpc";
import type { Instance } from "../shared/types";

// Omega Client's own Discord application (Rich Presence only - no OAuth scopes, so this never
// prompts a player to authorize or sign in to anything). Same shared-app model as store.ts's
// DEFAULT_MSA_CLIENT_ID: one id embedded in the launcher so it works with zero setup, rather than
// asking every player to register their own Discord application. Not user-configurable - Rich
// Presence art assets (see LARGE_IMAGE_KEY below) are uploaded per-application in the Developer
// Portal, so there's nothing a player could usefully override it with anyway.
const OMEGA_DISCORD_CLIENT_ID = "REPLACE_WITH_OMEGA_DISCORD_APPLICATION_ID";

// Must match a Rich Presence asset key uploaded under OMEGA_DISCORD_CLIENT_ID's application in the
// Discord Developer Portal (Rich Presence -> Art Assets). An unknown key just renders with no
// image rather than erroring, so there's nothing to validate here.
const LARGE_IMAGE_KEY = "omega_icon";

let client: Client | null = null;
// Dedupes concurrent ensureConnected() calls (e.g. two instances launched back to back) onto a
// single in-flight login rather than racing multiple RPC connections.
let connectPromise: Promise<void> | null = null;

async function ensureConnected(): Promise<Client | null> {
  if (client?.isConnected) {
    return client;
  }
  if (!connectPromise) {
    const next = new Client({ clientId: OMEGA_DISCORD_CLIENT_ID });
    connectPromise = next
      .login()
      .then(() => {
        client = next;
      })
      .catch((err) => {
        // Discord not installed/running - Rich Presence is purely cosmetic and best-effort, never
        // worth interrupting a launch over, and never surfaced as a login/auth prompt of any kind.
        console.warn("Discord Rich Presence: couldn't connect -", err instanceof Error ? err.message : err);
        client = null;
      })
      .finally(() => {
        connectPromise = null;
      });
  }
  await connectPromise;
  return client;
}

/** Sets the "Playing Omega Client" activity. No-ops silently if Discord isn't reachable. */
export async function setPlaying(instance: Instance, startedAt: number): Promise<void> {
  if (!OMEGA_DISCORD_CLIENT_ID || OMEGA_DISCORD_CLIENT_ID.startsWith("REPLACE_")) return;
  try {
    const c = await ensureConnected();
    if (!c?.user) return;
    await c.user.setActivity({
      details: "Playing Omega Client",
      state: instance.name,
      startTimestamp: startedAt,
      largeImageKey: LARGE_IMAGE_KEY,
      largeImageText: "Omega Client",
    });
  } catch (err) {
    console.warn("Discord Rich Presence: failed to set activity -", err instanceof Error ? err.message : err);
  }
}

export async function clearPresence(): Promise<void> {
  try {
    if (client?.isConnected) await client.user?.clearActivity();
  } catch (err) {
    console.warn("Discord Rich Presence: failed to clear activity -", err instanceof Error ? err.message : err);
  }
}

/** Fully tears down the RPC connection - called when the toggle is switched off and on app quit. */
export async function disconnect(): Promise<void> {
  const toClose = client;
  client = null;
  try {
    await toClose?.destroy();
  } catch {
    // Already disconnected (e.g. Discord quit first) - nothing left to clean up.
  }
}
