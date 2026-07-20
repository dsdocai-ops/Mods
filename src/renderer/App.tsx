// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Instance, LaunchLogEvent, PublicAccount } from "@shared/types";
import Sidebar, { type NavKey } from "./components/Sidebar";
import Home from "./pages/Home";
import Play from "./pages/Play";
import InstanceDetail from "./pages/InstanceDetail";
import CosmeticsPage from "./pages/Cosmetics";
import SettingsPage from "./pages/Settings";
import AboutPage from "./pages/About";
import NewInstanceDialog from "./pages/NewInstanceDialog";
import SignInRequired from "./pages/SignInRequired";
import ToastHost from "./components/ToastHost";
import { toast } from "./toast";

export default function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [nav, setNav] = useState<NavKey>("home");
  // Persists independently of nav - switching between Home/Play/Mods keeps the same instance in
  // context, matching the reference design's "one selected profile, several pages act on it" model.
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [switchAccountRequest, setSwitchAccountRequest] = useState<{ instanceId: string; token: number }>({
    instanceId: "",
    token: 0,
  });
  const [tabRequest, setTabRequest] = useState<{ tab: "mods" | "shaders" | "console" | "settings"; token: number } | null>(null);
  // Set when the auto-updater has finished downloading a new build in the background (packaged
  // installer builds only - dev runs and the portable exe never emit this event).
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  // null = still loading (don't flash the sign-in gate before we actually know); [] = no account
  // linked yet, gates the whole app - see SignInRequired.
  const [accounts, setAccounts] = useState<PublicAccount[] | null>(null);

  useEffect(() => window.api.updates.onReady(setUpdateVersion), []);

  const refreshAccounts = useCallback(async () => {
    const list = await window.api.accounts.list();
    setAccounts(list);
    return list;
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
    refreshInstances().then((list) => {
      if (list.length > 0) setSelectedInstanceId(list[0].id);
    });

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
      const prefix = event.stream === "stderr" ? "[err] " : event.stream === "status" ? "[launcher] " : "";
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
    });

    const unsubscribeSwitchAccount = window.api.launch.onSwitchAccountRequested((instanceId: string) => {
      setSwitchAccountRequest({ instanceId, token: Date.now() });
      setSelectedInstanceId(instanceId);
      setNav("mods");
    });

    return () => {
      unsubscribe();
      unsubscribeSwitchAccount();
    };
  }, []);

  const selectedInstance = useMemo(() => instances.find((i) => i.id === selectedInstanceId) ?? null, [selectedInstanceId, instances]);

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
      // invisible if you hit Play from Home/Play without switching to Mods first.
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

  const handleNewInstance = useCallback(() => setShowNewInstance(true), []);
  const openInstanceSettings = useCallback(() => {
    setNav("mods");
    setTabRequest({ tab: "settings", token: Date.now() });
  }, []);
  const openMods = useCallback(() => {
    setNav("mods");
    setTabRequest({ tab: "mods", token: Date.now() });
  }, []);

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
      <Sidebar active={nav} onNavigate={setNav} />

      <main className="main-area">
        {nav === "home" && (
          <Home
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={setSelectedInstanceId}
            onNewInstance={handleNewInstance}
            accounts={accounts}
            isRunning={selectedInstance ? runningIds.has(selectedInstance.id) : false}
            onLaunch={() => selectedInstance && handleLaunch(selectedInstance)}
            onStop={() => selectedInstance && handleStop(selectedInstance)}
            onOpenInstanceSettings={openInstanceSettings}
          />
        )}

        {nav === "play" && (
          <Play
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={setSelectedInstanceId}
            onNewInstance={handleNewInstance}
            isRunning={selectedInstance ? runningIds.has(selectedInstance.id) : false}
            onLaunch={() => selectedInstance && handleLaunch(selectedInstance)}
            onStop={() => selectedInstance && handleStop(selectedInstance)}
            onOpenMods={openMods}
            onOpenInstanceSettings={openInstanceSettings}
          />
        )}

        {nav === "mods" && selectedInstance && (
          <InstanceDetail
            key={selectedInstance.id}
            instance={selectedInstance}
            logLines={logs[selectedInstance.id] ?? []}
            isRunning={runningIds.has(selectedInstance.id)}
            onLaunch={() => handleLaunch(selectedInstance)}
            onStop={() => handleStop(selectedInstance)}
            onInstanceChanged={refreshInstances}
            onOpenGlobalSettings={() => setNav("settings")}
            accountSwitchOpenSignal={switchAccountRequest.instanceId === selectedInstance.id ? switchAccountRequest.token : 0}
            tabRequest={tabRequest}
            onDeleted={async () => {
              try {
                await window.api.instances.delete(selectedInstance.id);
                const list = await refreshInstances();
                setSelectedInstanceId(list.length > 0 ? list[0].id : null);
                setNav("home");
              } catch (err) {
                toast(`Couldn't delete ${selectedInstance.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
              }
            }}
          />
        )}
        {nav === "mods" && !selectedInstance && (
          <div className="welcome">
            <h1>No instance selected</h1>
            <p>Create an instance from the Play page to get started.</p>
          </div>
        )}

        {nav === "cosmetics" && <CosmeticsPage />}
        {nav === "settings" && <SettingsPage onAccountsChanged={refreshAccounts} />}
        {nav === "about" && <AboutPage />}
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
            setSelectedInstanceId(instance.id);
            setNav("mods");
          }}
        />
      )}
    </div>
  );
}
