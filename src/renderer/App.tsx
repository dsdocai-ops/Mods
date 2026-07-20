// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Instance, LaunchLogEvent, PublicAccount } from "@shared/types";
import { resolveBannerTheme } from "@shared/banners";
import Sidebar, { type NavKey } from "./components/Sidebar";
import InstanceDetail, { type Tab } from "./pages/InstanceDetail";
import SettingsPage from "./pages/Settings";
import NewInstanceDialog from "./pages/NewInstanceDialog";
import Home from "./pages/Home";
import Play from "./pages/Play";
import Cosmetics from "./pages/Cosmetics";
import About from "./pages/About";
import SignInRequired from "./pages/SignInRequired";
import ToastHost from "./components/ToastHost";
import LaunchOverlay, { type LaunchPhase } from "./components/LaunchOverlay";
import SessionEndedOverlay from "./components/SessionEndedOverlay";
import { toast } from "./toast";

// "Ignition" overlay timing. The min-display gate keeps the overlay up this long before the success
// beat can start, so an instant-resolving start() doesn't flash - the moment reads as deliberate.
const OVERLAY_MIN_DISPLAY_MS = 1600;
const OVERLAY_SUCCESS_HOLD_MS = 900;
const OVERLAY_CLOSE_MS = 450; // matches the .launch-overlay-closing fade-out
const OVERLAY_CLOSE_FAST_MS = 250; // matches .launch-overlay-fast (failure path)

// "Afterglow" session-ended beat: fixed 0.3s fade-in + 1.6s hold + 0.5s fade-out. The whole timeline
// is one .session-ended opacity keyframe, so this single timeout just unmounts the beat when it ends.
const SESSION_ENDED_TOTAL_MS = 2400;

// One view per sidebar nav item, plus the instance-detail view (reached from Home/Play). Instance
// detail carries which tab to open and which nav item to highlight while it's showing (Play, unless
// deep-linked from the Mods nav item).
type View =
  | { kind: "home" }
  | { kind: "play" }
  | { kind: "cosmetics" }
  | { kind: "settings" }
  | { kind: "about" }
  | { kind: "instance"; id: string; initialTab: Tab | undefined; nav: "play" | "mods" };

export default function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [view, setView] = useState<View>({ kind: "home" });
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [switchAccountRequest, setSwitchAccountRequest] = useState<{ instanceId: string; token: number }>({
    instanceId: "",
    token: 0,
  });
  // Set when the auto-updater has finished downloading a new build in the background (packaged
  // installer builds only - dev runs and the portable exe never emit this event).
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  // null = still loading (don't flash the sign-in gate before we actually know); [] = no account
  // linked yet, gates the whole app - see SignInRequired.
  const [accounts, setAccounts] = useState<PublicAccount[] | null>(null);

  // The launch "Ignition" overlay - purely additive presentation around handleLaunch. null = unmounted
  // (app stays fully interactive). See handleLaunch for the phase machine; fast = failure fade-out.
  const [launchOverlay, setLaunchOverlay] = useState<{
    instanceId: string;
    name: string;
    phase: LaunchPhase;
    fast: boolean;
    // Resolved banner theme's CSS filter, for the overlay's blurred art backdrop layer.
    bannerFilter: string;
  } | null>(null);
  // The one-line status is set ONLY on stream === "status" events (stdout floods ~30/s - never per line).
  const [launchStatus, setLaunchStatus] = useState("Preparing…");
  // Pending phase-advance timeouts, cleared whenever a new launch (or a dismiss) supersedes the overlay.
  const overlayTimersRef = useRef<number[]>([]);
  // Bumped on every new launch and on dismiss; async start() resolutions guard on it so a superseded
  // launch can never drive the current overlay.
  const overlayTokenRef = useRef(0);
  // Read inside the onLog subscription (registered once) so status events only update the overlay while
  // its instance is the one launching.
  const overlayInstanceRef = useRef<string | null>(null);
  overlayInstanceRef.current = launchOverlay?.instanceId ?? null;
  // Whether the Ignition overlay is mounted (any phase). Read from the once-registered onLog handler to
  // suppress the Afterglow beat during an instant-exit race (Ignition's close + the crash toast own that).
  const launchOverlayMountedRef = useRef(false);
  launchOverlayMountedRef.current = launchOverlay !== null;

  // "Afterglow" session-ended beat - additive presentation over the exit handling below. null = unmounted.
  const [sessionEnded, setSessionEnded] = useState<{
    instanceId: string;
    name: string;
    durationMs: number | null;
    // Resolved banner theme's CSS filter, for the Afterglow's blurred art backdrop layer.
    bannerFilter: string;
  } | null>(null);
  // Session start times, keyed by instance id: set in handleLaunch (before start() resolves), consumed and
  // deleted when that instance's exit event arrives, to compute the "Played for …" duration. Renderer-
  // lifetime only - a launcher restart mid-session loses the entry, and the duration line is then omitted.
  const sessionStartTimesRef = useRef<Map<string, number>>(new Map());
  // The single unmount timer for the beat; cleared on replace (a newer exit) and on unmount.
  const sessionEndedTimerRef = useRef<number | null>(null);

  // Kept current every render so the stable `navigate`/`openInstance` callbacks (which must not
  // change identity, or the memoized Sidebar re-renders on every log flush) can read the latest
  // instances and the last-opened instance without depending on them.
  const instancesRef = useRef<Instance[]>(instances);
  instancesRef.current = instances;
  const activeInstanceIdRef = useRef<string | null>(null);

  // Whether the "Ignition"/"Afterglow" overlays are allowed to show, per the Settings toggle. A ref
  // (not state) because it's read from handleLaunch and the once-registered onLog subscription, both
  // of which would otherwise see a stale closure over the setting's value at mount time. Defaults to
  // true (the setting's own default) until settings.get() resolves, so the very first launch of a
  // session isn't silently un-animated while that fetch is in flight.
  const launchAnimationsEnabledRef = useRef(true);
  const refreshLaunchAnimationsSetting = useCallback(() => {
    window.api.settings
      .get()
      .then((s) => {
        launchAnimationsEnabledRef.current = s.launchAnimationsEnabled;
      })
      .catch(() => {});
  }, []);

  useEffect(() => window.api.updates.onReady(setUpdateVersion), []);
  useEffect(() => refreshLaunchAnimationsSetting(), [refreshLaunchAnimationsSetting]);

  const refreshAccounts = useCallback(async () => {
    try {
      const list = await window.api.accounts.list();
      setAccounts(list);
      return list;
    } catch (err) {
      // Never leave `accounts` stuck at null - that renders the blank app-shell "loading" screen
      // forever. Fall back to the sign-in gate (an empty list) so the app stays usable and the user
      // can retry, and surface why.
      toast(`Couldn't load your accounts: ${err instanceof Error ? err.message : String(err)}`, "error");
      setAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const refreshInstances = async () => {
    const list = await window.api.instances.list();
    setInstances(list);
    return list;
  };

  // Minecraft can emit a burst of dozens of log lines within a single tick (mod loading, chunk
  // spam), and each one arrives as a separate IPC event. Committing every single one straight to
  // React state would mean a full re-render for each line - buffer them and flush on a short timer
  // instead, so a 50-line burst becomes one state update/re-render instead of 50. setTimeout, NOT
  // requestAnimationFrame: Electron pauses rAF entirely while the window is hidden/minimized, which
  // would leave the buffer growing for as long as the launcher sits minimized with a game running
  // (timers still fire in background windows, just clamped to ~1s - fine for log display).
  const MAX_LOG_LINES = 2000;
  const logBufferRef = useRef<Record<string, string[]>>({});
  const flushScheduledRef = useRef(false);

  useEffect(() => {
    // Land on Home (the mockup's landing screen) - it owns profile selection and PLAY, so
    // there's no auto-jump into the first instance's detail view anymore.
    refreshInstances();

    const flushLogBuffer = () => {
      flushScheduledRef.current = false;
      const buffered = logBufferRef.current;
      logBufferRef.current = {};
      setLogs((prev) => {
        const next = { ...prev };
        for (const [instanceId, newLines] of Object.entries(buffered)) {
          next[instanceId] = [...(next[instanceId] ?? []), ...newLines].slice(-MAX_LOG_LINES);
        }
        return next;
      });
    };

    const unsubscribe = window.api.launch.onLog((event: LaunchLogEvent) => {
      const prefix = event.stream === "stderr" ? "[err] " : event.stream === "status" || event.stream === "crash" ? "[launcher] " : "";
      const line = event.stream === "exit" ? `[launcher] process exited (code ${event.data})` : `${prefix}${event.data}`;
      const buffer = logBufferRef.current;
      const lines = (buffer[event.instanceId] ??= []);
      lines.push(line);
      // Cap the buffer itself too - only the last MAX_LOG_LINES survive the flush anyway, so
      // anything beyond that is pure memory growth if flushes are being throttled/delayed.
      if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES);
      if (!flushScheduledRef.current) {
        flushScheduledRef.current = true;
        setTimeout(flushLogBuffer, 33);
      }

      // Drive the overlay's status line only from status-stream events for the launching instance -
      // stdout arrives ~30 lines/s, so setState per stdout line would thrash the overlay.
      if (event.stream === "status" && event.instanceId === overlayInstanceRef.current) {
        setLaunchStatus(event.data);
      }

      if (event.stream === "exit") {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(event.instanceId);
          return next;
        });

        // "Afterglow" beat - purely additive, doesn't touch the runningIds/crash logic above. Consume the
        // start time on every exit (even suppressed/dirty ones) so the map never leaks stale entries.
        const startedAt = sessionStartTimesRef.current.get(event.instanceId);
        sessionStartTimesRef.current.delete(event.instanceId);
        // Clean exit only: code 0/null/undefined. main.ts emits String(code ?? "unknown"), the driver a
        // raw number - so a definite non-zero numeric code is the only "dirty" case (error territory, the
        // crash toast owns it). Skip the beat entirely while the Ignition overlay is up (instant-exit race).
        const raw = event.data as unknown;
        const codeNum = raw === null || raw === undefined ? 0 : Number(raw);
        const cleanExit = !Number.isFinite(codeNum) || codeNum === 0;
        if (cleanExit && !launchOverlayMountedRef.current && launchAnimationsEnabledRef.current) {
          const endedInstance = instancesRef.current.find((i) => i.id === event.instanceId);
          const name = endedInstance?.name ?? "Game";
          const bannerFilter = resolveBannerTheme(event.instanceId, endedInstance?.banner).filter;
          const durationMs = startedAt != null ? Date.now() - startedAt : null;
          // Replace-and-reset: a second exit while a beat is showing supersedes it (reset the timer).
          if (sessionEndedTimerRef.current !== null) window.clearTimeout(sessionEndedTimerRef.current);
          setSessionEnded({ instanceId: event.instanceId, name, durationMs, bannerFilter });
          sessionEndedTimerRef.current = window.setTimeout(() => {
            sessionEndedTimerRef.current = null;
            setSessionEnded(null);
          }, SESSION_ENDED_TOTAL_MS);
        }
      }

      // Without this, a fast crash-on-boot (wrong Java version, a graphics driver failure, a
      // corrupt install) looks identical to a successful launch from the UI's perspective: the
      // Play button briefly showed "running", then quietly went back to "Play" with no window
      // ever appearing and no indication why - see main.ts's EARLY_EXIT_THRESHOLD_MS.
      if (event.stream === "crash") {
        toast(event.data, "error");
      }
    });

    const unsubscribeSwitchAccount = window.api.launch.onSwitchAccountRequested((instanceId: string) => {
      setSwitchAccountRequest({ instanceId, token: Date.now() });
      activeInstanceIdRef.current = instanceId;
      setView({ kind: "instance", id: instanceId, initialTab: "mods", nav: "play" });
    });

    return () => {
      unsubscribe();
      unsubscribeSwitchAccount();
      if (sessionEndedTimerRef.current !== null) window.clearTimeout(sessionEndedTimerRef.current);
    };
  }, []);

  const selectedInstance = useMemo(() => {
    if (view.kind !== "instance") return null;
    return instances.find((i) => i.id === view.id) ?? null;
  }, [view, instances]);

  // Overlay-only helpers. clearOverlayTimers is called before any new phase is scheduled so a prior
  // launch's pending success/hold/unmount timers can never fire against the current overlay.
  const clearOverlayTimers = () => {
    for (const id of overlayTimersRef.current) window.clearTimeout(id);
    overlayTimersRef.current = [];
  };
  // token guards the async close so a launch that got superseded (new launch, or a dismiss bumping the
  // token) can't reschedule phases or unmount the overlay that now belongs to someone else.
  const closeOverlay = (token: number, durationMs: number) => {
    if (overlayTokenRef.current !== token) return;
    setLaunchOverlay((o) => (o ? { ...o, phase: "closing", fast: durationMs === OVERLAY_CLOSE_FAST_MS } : o));
    overlayTimersRef.current.push(
      window.setTimeout(() => {
        if (overlayTokenRef.current === token) setLaunchOverlay(null);
      }, durationMs)
    );
  };
  // Escape hatch: skip straight to fade-out. Bumping the token abandons any in-flight start() resolution
  // so it can't re-drive the overlay; the launch itself continues in the background untouched.
  const dismissOverlay = () => {
    clearOverlayTimers();
    const token = ++overlayTokenRef.current;
    closeOverlay(token, OVERLAY_CLOSE_MS);
  };

  const handleLaunch = async (instance: Instance) => {
    // Additive overlay setup - none of this touches runningIds/toast/refresh below. A second launch
    // while an overlay is still closing resets cleanly: clear pending timers and take a fresh token.
    clearOverlayTimers();
    const token = ++overlayTokenRef.current;
    const shownAt = Date.now();
    // Record the session start now (before start() resolves) so the Afterglow beat can report how long
    // the session ran; the exit handler consumes and clears this entry.
    sessionStartTimesRef.current.set(instance.id, shownAt);
    setLaunchStatus("Preparing…");
    if (launchAnimationsEnabledRef.current) {
      setLaunchOverlay({
        instanceId: instance.id,
        name: instance.name,
        phase: "igniting",
        fast: false,
        bannerFilter: resolveBannerTheme(instance.id, instance.banner).filter,
      });
    }

    setRunningIds((prev) => new Set(prev).add(instance.id));
    try {
      await window.api.launch.start(instance);
      // A Stop click that landed while start() was still pending (the game isn't registered in
      // the main process's runningProcesses yet, so launch:stop is a no-op there) would already
      // have removed this id from runningIds below - re-add it now that the launch is confirmed to
      // have actually succeeded, so the UI reflects reality instead of whatever that race left it in.
      setRunningIds((prev) => new Set(prev).add(instance.id));
      // Success beat, but only after the min-display gate: enter "success" once start resolved AND the
      // overlay has been up long enough, hold, then fade out and unmount.
      if (overlayTokenRef.current === token) {
        const wait = Math.max(0, OVERLAY_MIN_DISPLAY_MS - (Date.now() - shownAt));
        overlayTimersRef.current.push(
          window.setTimeout(() => {
            if (overlayTokenRef.current !== token) return;
            setLaunchOverlay((o) => (o ? { ...o, phase: "success" } : o));
            overlayTimersRef.current.push(
              window.setTimeout(() => closeOverlay(token, OVERLAY_CLOSE_MS), OVERLAY_SUCCESS_HOLD_MS)
            );
          }, wait)
        );
      }
    } catch (err) {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
      // Also surface it as a toast - the full error already lands in the Console tab, but that's
      // invisible if you hit Play from the Mods tab and nothing appears to happen.
      toast(`Launch failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      // The toast already reports the failure - the overlay just gets out of the way fast, no duplicate.
      clearOverlayTimers();
      closeOverlay(token, OVERLAY_CLOSE_FAST_MS);
    }
    refreshInstances();
  };

  const handleStop = async (instance: Instance) => {
    try {
      await window.api.launch.stop(instance.id);
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
    } catch (err) {
      // Without this, a rejected stop() left the Play/Stop button permanently stuck on "Stop"
      // with no explanation - reconcile against the main process's actual view of what's running
      // rather than guessing, since the failure could mean "still running" or "already exited".
      const stillRunning = await window.api.launch.isRunning(instance.id);
      setRunningIds((prev) => {
        const next = new Set(prev);
        if (stillRunning) next.add(instance.id);
        else next.delete(instance.id);
        return next;
      });
      toast(`Couldn't stop ${instance.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  // Stable references so the memoized Sidebar doesn't re-render on every log flush (App re-renders
  // ~30x/s while a game streams output; the sidebar's active-nav prop doesn't actually change then).
  const openInstance = useCallback((id: string, nav: "play" | "mods" = "play", initialTab?: Tab) => {
    activeInstanceIdRef.current = id;
    setView({ kind: "instance", id, initialTab, nav });
  }, []);
  const handleNewInstance = useCallback(() => setShowNewInstance(true), []);
  const handleOpenSettings = useCallback(() => setView({ kind: "settings" }), []);

  const navigate = useCallback(
    (key: NavKey) => {
      if (key === "mods") {
        // Mods is per-instance in this launcher, so the Mods nav item deep-links to the last-opened
        // instance's Mods tab (falling back to the first instance). With none, send them to Play to
        // create one.
        const list = instancesRef.current;
        const active = list.find((i) => i.id === activeInstanceIdRef.current) ?? list[0] ?? null;
        if (active) openInstance(active.id, "mods", "mods");
        else setView({ kind: "play" });
        return;
      }
      setView({ kind: key });
    },
    [openInstance]
  );

  // Which sidebar item to highlight for the current view - instance detail highlights whichever nav
  // item opened it (Play, or Mods when deep-linked).
  const activeNav: NavKey = view.kind === "instance" ? view.nav : view.kind;

  // Gates literally everything else in the app - sidebar, instances, settings - behind a linked
  // Microsoft account. Rendered instead of the app shell, not layered over it.
  if (accounts === null) return <div className="app-shell" />;
  if (accounts.length === 0) return <SignInRequired onSignedIn={refreshAccounts} />;

  return (
    <div className="app-shell">
      <ToastHost />
      {launchOverlay && (
        <LaunchOverlay
          name={launchOverlay.name}
          phase={launchOverlay.phase}
          status={launchStatus}
          fast={launchOverlay.fast}
          bannerFilter={launchOverlay.bannerFilter}
          onDismiss={dismissOverlay}
        />
      )}
      {sessionEnded && (
        <SessionEndedOverlay
          name={sessionEnded.name}
          durationMs={sessionEnded.durationMs}
          bannerFilter={sessionEnded.bannerFilter}
        />
      )}
      {updateVersion && (
        <div className="update-banner">
          <span>
            Update <strong>v{updateVersion}</strong> downloaded &mdash; it also applies automatically on next quit.
          </span>
          <button className="btn btn-primary" onClick={() => window.api.updates.install()}>
            Restart now
          </button>
          <button className="btn" onClick={() => setUpdateVersion(null)}>
            Later
          </button>
        </div>
      )}
      <Sidebar active={activeNav} onNavigate={navigate} />

      <main className={view.kind === "home" ? "main-area main-area-flush" : "main-area"}>
        {view.kind === "home" && (
          <Home
            instances={instances}
            accounts={accounts}
            runningIds={runningIds}
            onNewInstance={handleNewInstance}
            onOpenInstance={(id) => openInstance(id)}
            onLaunch={handleLaunch}
            onStop={handleStop}
          />
        )}
        {view.kind === "play" && (
          <Play
            instances={instances}
            runningIds={runningIds}
            onNewInstance={handleNewInstance}
            onOpenInstance={(id) => openInstance(id)}
            onLaunch={handleLaunch}
            onStop={handleStop}
          />
        )}
        {view.kind === "cosmetics" && <Cosmetics />}
        {view.kind === "about" && <About />}
        {view.kind === "settings" && (
          <SettingsPage onAccountsChanged={refreshAccounts} onSettingsChanged={refreshLaunchAnimationsSetting} />
        )}
        {view.kind === "instance" && selectedInstance && (
          <InstanceDetail
            key={selectedInstance.id}
            instance={selectedInstance}
            logLines={logs[selectedInstance.id] ?? []}
            isRunning={runningIds.has(selectedInstance.id)}
            initialTab={view.initialTab}
            onLaunch={() => handleLaunch(selectedInstance)}
            onStop={() => handleStop(selectedInstance)}
            onInstanceChanged={refreshInstances}
            onOpenGlobalSettings={handleOpenSettings}
            onBack={() => setView({ kind: "play" })}
            accountSwitchOpenSignal={switchAccountRequest.instanceId === selectedInstance.id ? switchAccountRequest.token : 0}
            onDeleted={async () => {
              try {
                await window.api.instances.delete(selectedInstance.id);
                const list = await refreshInstances();
                if (list.length > 0) openInstance(list[0].id);
                else setView({ kind: "play" });
              } catch (err) {
                toast(`Couldn't delete ${selectedInstance.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
              }
            }}
          />
        )}
      </main>

      {showNewInstance && (
        <NewInstanceDialog
          onClose={() => setShowNewInstance(false)}
          onCreated={async (instance) => {
            setShowNewInstance(false);
            // Sign-in is required to reach this dialog at all, so there's always >=1 account -
            // every new instance uses it by default rather than falling back to offline play.
            if (!instance.accountId && accounts.length > 0) {
              await window.api.instances.update({ ...instance, accountId: accounts[0].id });
            }
            await refreshInstances();
            openInstance(instance.id);
          }}
        />
      )}
    </div>
  );
}
