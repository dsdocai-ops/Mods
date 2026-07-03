import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Instance, LaunchLogEvent } from "@shared/types";
import Sidebar from "./components/Sidebar";
import InstanceDetail from "./pages/InstanceDetail";
import SettingsPage from "./pages/Settings";
import NewInstanceDialog from "./pages/NewInstanceDialog";
import Welcome from "./pages/Welcome";
import ToastHost from "./components/ToastHost";
import { toast } from "./toast";

type View = { kind: "instance"; id: string } | { kind: "settings" } | { kind: "welcome" };

export default function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [view, setView] = useState<View>({ kind: "welcome" });
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

  useEffect(() => window.api.updates.onReady(setUpdateVersion), []);

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
      if (list.length > 0) setView({ kind: "instance", id: list[0].id });
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
      setView({ kind: "instance", id: instanceId });
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
  // ~30x/s while a game streams output; the sidebar's props don't actually change then).
  const handleSelect = useCallback((id: string) => setView({ kind: "instance", id }), []);
  const handleNewInstance = useCallback(() => setShowNewInstance(true), []);
  const handleOpenSettings = useCallback(() => setView({ kind: "settings" }), []);

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
      <Sidebar
        instances={instances}
        selectedId={view.kind === "instance" ? view.id : null}
        onSelect={handleSelect}
        onNewInstance={handleNewInstance}
        onSettings={handleOpenSettings}
        runningIds={runningIds}
      />

      <main className="main-area">
        {view.kind === "welcome" && <Welcome onNewInstance={handleNewInstance} />}
        {view.kind === "settings" && <SettingsPage />}
        {view.kind === "instance" && selectedInstance && (
          <InstanceDetail
            key={selectedInstance.id}
            instance={selectedInstance}
            logLines={logs[selectedInstance.id] ?? []}
            isRunning={runningIds.has(selectedInstance.id)}
            onLaunch={() => handleLaunch(selectedInstance)}
            onStop={() => handleStop(selectedInstance)}
            onInstanceChanged={refreshInstances}
            onOpenGlobalSettings={handleOpenSettings}
            accountSwitchOpenSignal={switchAccountRequest.instanceId === selectedInstance.id ? switchAccountRequest.token : 0}
            onDeleted={async () => {
              try {
                await window.api.instances.delete(selectedInstance.id);
                const list = await refreshInstances();
                setView(list.length > 0 ? { kind: "instance", id: list[0].id } : { kind: "welcome" });
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
            await refreshInstances();
            setView({ kind: "instance", id: instance.id });
          }}
        />
      )}
    </div>
  );
}
