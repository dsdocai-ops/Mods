import { useEffect, useMemo, useState } from "react";
import type { Instance, LaunchLogEvent } from "@shared/types";
import Sidebar from "./components/Sidebar";
import InstanceDetail from "./pages/InstanceDetail";
import SettingsPage from "./pages/Settings";
import NewInstanceDialog from "./pages/NewInstanceDialog";
import Welcome from "./pages/Welcome";
import ToastHost from "./components/ToastHost";

type View = { kind: "instance"; id: string } | { kind: "settings" } | { kind: "welcome" };

export default function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [view, setView] = useState<View>({ kind: "welcome" });
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const refreshInstances = async () => {
    const list = await window.api.instances.list();
    setInstances(list);
    return list;
  };

  useEffect(() => {
    refreshInstances().then((list) => {
      if (list.length > 0) setView({ kind: "instance", id: list[0].id });
    });

    const unsubscribe = window.api.launch.onLog((event: LaunchLogEvent) => {
      setLogs((prev) => {
        const existing = prev[event.instanceId] ?? [];
        const prefix = event.stream === "stderr" ? "[err] " : event.stream === "status" ? "[launcher] " : "";
        const line = event.stream === "exit" ? `[launcher] process exited (code ${event.data})` : `${prefix}${event.data}`;
        return { ...prev, [event.instanceId]: [...existing, line].slice(-2000) };
      });
      if (event.stream === "exit") {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(event.instanceId);
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const selectedInstance = useMemo(() => {
    if (view.kind !== "instance") return null;
    return instances.find((i) => i.id === view.id) ?? null;
  }, [view, instances]);

  const handleLaunch = async (instance: Instance) => {
    setRunningIds((prev) => new Set(prev).add(instance.id));
    try {
      await window.api.launch.start(instance);
    } catch {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
    }
    refreshInstances();
  };

  const handleStop = async (instance: Instance) => {
    await window.api.launch.stop(instance.id);
    setRunningIds((prev) => {
      const next = new Set(prev);
      next.delete(instance.id);
      return next;
    });
  };

  return (
    <div className="app-shell">
      <ToastHost />
      <Sidebar
        instances={instances}
        selectedId={view.kind === "instance" ? view.id : null}
        onSelect={(id) => setView({ kind: "instance", id })}
        onNewInstance={() => setShowNewInstance(true)}
        onSettings={() => setView({ kind: "settings" })}
        runningIds={runningIds}
      />

      <main className="main-area">
        {view.kind === "welcome" && <Welcome onNewInstance={() => setShowNewInstance(true)} />}
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
            onDeleted={async () => {
              await window.api.instances.delete(selectedInstance.id);
              const list = await refreshInstances();
              setView(list.length > 0 ? { kind: "instance", id: list[0].id } : { kind: "welcome" });
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
