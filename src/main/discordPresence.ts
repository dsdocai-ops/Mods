// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { Client } from "@xhayper/discord-rpc";
import type { Instance } from "../shared/types";

// Must match a Rich Presence asset key uploaded under the configured application in the Discord
// Developer Portal (Rich Presence -> Art Assets) - see README. An unknown key just renders with no
// image rather than erroring, so there's nothing to validate here.
const LARGE_IMAGE_KEY = "omega_icon";

let client: Client | null = null;
let connectedClientId: string | null = null;
// Dedupes concurrent ensureConnected() calls (e.g. two instances launched back to back) onto a
// single in-flight login rather than racing multiple RPC connections for the same client id.
let connectPromise: Promise<void> | null = null;

async function ensureConnected(clientId: string): Promise<Client | null> {
  if (connectedClientId && connectedClientId !== clientId) {
    await disconnect();
  }
  if (client?.isConnected) {
    return client;
  }
  if (!connectPromise) {
    const next = new Client({ clientId });
    connectedClientId = clientId;
    connectPromise = next
      .login()
      .then(() => {
        client = next;
      })
      .catch((err) => {
        // Discord not installed/running, or an invalid client id - Rich Presence is purely
        // cosmetic and best-effort, never worth interrupting a launch over.
        console.warn("Discord Rich Presence: couldn't connect -", err instanceof Error ? err.message : err);
        client = null;
        connectedClientId = null;
      })
      .finally(() => {
        connectPromise = null;
      });
  }
  await connectPromise;
  return client;
}

/** Sets the "Playing Omega Client" activity. No-ops silently if disabled, unconfigured, or Discord isn't reachable. */
export async function setPlaying(instance: Instance, clientId: string, startedAt: number): Promise<void> {
  if (!clientId) return;
  try {
    const c = await ensureConnected(clientId);
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
  connectedClientId = null;
  try {
    await toClose?.destroy();
  } catch {
    // Already disconnected (e.g. Discord quit first) - nothing left to clean up.
  }
}
