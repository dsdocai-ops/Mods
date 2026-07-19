// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Instance, LaunchLogEvent, PublicAccount } from "@shared/types";
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
import { toast } from "./toast";

// One view per sidebar nav item, plus the instance-detail view (reached from Home/Play). Instance
// detail carries which tab to open and which nav item to highlight while it's showing (Play, unless
// deep-linked from the Mods nav item).
type View =
  | { kind: "home" }
  | { kind: "play" }
  | { kind: "cosmetics" }
  | { kind: "settings" }
  | { kind: "about" }
  | { kind: "instance"; id: string; initialTab: Tab; nav: "play" | "mods" };

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

  // Kept current every render so the stable `navigate`/`openInstance` callbacks (which must not
  // change identity, or the memoized Sidebar re-renders on every log flush) can read the latest
  // instances and the last-opened instance without depending on them.
  const instancesRef = useRef<Instance[]>(instances);
  instancesRef.current = instances;
  const activeInstanceIdRef = useRef<string | null>(null);

  useEffect(() => window.api.updates.onReady(setUpdateVersion), []);

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

      if (event.stream === "exit") {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(event.instanceId);
          return next;
        });
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
    };
  }, []);

  const selectedInstance = useMemo(() => {
    if (view.kind !== "instance") return null;
    return instances.find((i) => i.id === view.id) ?? null;
  }, [view, instances]);

  const handleLaunch = async (instance: Instance) => {
    setRunningIds((prev) => new Set(prev).add(instance.id));
    try {
      await window.api.launch.start(instance);
      // A Stop click that landed while start() was still pending (the game isn't registered in
      // the main process's runningProcesses yet, so launch:stop is a no-op there) would already
      // have removed this id from runningIds below - re-add it now that the launch is confirmed to
      // have actually succeeded, so the UI reflects reality instead of whatever that race left it in.
      setRunningIds((prev) => new Set(prev).add(instance.id));
    } catch (err) {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
      // Also surface it as a toast - the full error already lands in the Console tab, but that's
      // invisible if you hit Play from the Mods tab and nothing appears to happen.
      toast(`Launch failed: ${err instanceof Error ? err.message : String(err)}`, "error");
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
  const openInstance = useCallback((id: string, nav: "play" | "mods" = "play", initialTab: Tab = "mods") => {
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
        {view.kind === "settings" && <SettingsPage onAccountsChanged={refreshAccounts} />}
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
