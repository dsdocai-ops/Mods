import { useEffect, useMemo, useState } from "react";
import type { ConfigFormat, Instance, ModInfo, ModTag } from "@shared/types";
import { MOD_TAG_PRESETS } from "@shared/types";
import ModRow from "../components/ModRow";
import ConsoleLog from "../components/ConsoleLog";
import ConfigModal from "../components/ConfigModal";
import { toast } from "../toast";

interface Props {
  instance: Instance;
  logLines: string[];
  isRunning: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onInstanceChanged: () => void;
  onDeleted: () => void;
}

type Tab = "mods" | "console" | "settings";

export default function InstanceDetail({ instance, logLines, isRunning, onLaunch, onStop, onInstanceChanged, onDeleted }: Props) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Tab>("mods");
  const [draft, setDraft] = useState<Instance>(instance);
  const [configTarget, setConfigTarget] = useState<{
    modName: string;
    filePath: string;
    format: ConfigFormat;
    data: Record<string, unknown>;
  } | null>(null);

  const loadMods = async () => {
    const list = await window.api.mods.list(instance.modsDir);
    setMods(list);
  };

  useEffect(() => {
    loadMods();
    setDraft(instance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, instance.modsDir]);

  const filteredMods = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return mods;
    return mods.filter((m) => m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)));
  }, [mods, filter]);

  const handleImport = async () => {
    const paths = await window.api.dialog.pickJarFiles();
    if (paths.length === 0) return;
    const updated = await window.api.mods.import(instance.modsDir, paths);
    setMods(updated);
  };

  const handleToggle = async (mod: ModInfo, enabled: boolean) => {
    setMods((prev) => prev.map((m) => (m.id === mod.id ? { ...m, enabled } : m)));
    const updated = await window.api.mods.setEnabled(instance.modsDir, mod.id, enabled);
    setMods(updated);
  };

  const handleRemove = async (mod: ModInfo) => {
    const updated = await window.api.mods.remove(instance.modsDir, mod.id);
    setMods(updated);
  };

  const openConfig = async (mod: ModInfo) => {
    const path = await window.api.modConfig.find(instance.modsDir, mod.modId);
    if (!path) {
      toast(`No config file found for ${mod.name} yet - it may need to run once, or doesn't use JSON/TOML config.`, "info");
      return;
    }
    try {
      const file = await window.api.modConfig.read(path);
      setConfigTarget({ modName: mod.name, filePath: file.path, format: file.format, data: file.data });
    } catch (err) {
      toast(`Couldn't read config for ${mod.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const applyPreset = async (tags: ModTag[]) => {
    const updated = await window.api.mods.applyPreset(instance.modsDir, tags);
    setMods(updated);
  };

  const enableAll = async () => {
    const changes = Object.fromEntries(mods.filter((m) => !m.enabled).map((m) => [m.id, true]));
    const updated = await window.api.mods.setEnabledBulk(instance.modsDir, changes);
    setMods(updated);
  };

  const disableAll = async () => {
    const changes = Object.fromEntries(mods.filter((m) => m.enabled).map((m) => [m.id, false]));
    const updated = await window.api.mods.setEnabledBulk(instance.modsDir, changes);
    setMods(updated);
  };

  const saveDraft = async () => {
    await window.api.instances.update(draft);
    onInstanceChanged();
  };

  const enabledCount = mods.filter((m) => m.enabled).length;

  return (
    <div className="instance-detail">
      <header className="instance-header">
        <div>
          <h1>{instance.name}</h1>
          <p className="instance-subtitle">
            {instance.versionId} &middot; {instance.loader} &middot; {enabledCount}/{mods.length} mods enabled
          </p>
        </div>
        <div className="instance-actions">
          {isRunning ? (
            <button className="btn btn-danger" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className="btn btn-primary btn-play" onClick={onLaunch}>
              ▶ Play
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "mods" ? "tab active" : "tab"} onClick={() => setTab("mods")}>
          Mods
        </button>
        <button className={tab === "console" ? "tab active" : "tab"} onClick={() => setTab("console")}>
          Console
        </button>
        <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>
          Instance Settings
        </button>
      </nav>

      {tab === "mods" && (
        <div className="mods-panel">
          <div className="mods-toolbar">
            <input
              className="input"
              placeholder="Search mods or tags (e.g. pvp, performance)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={handleImport}>
              + Import your mods
            </button>
          </div>

          <div className="preset-bar">
            <span className="preset-label">Presets:</span>
            {Object.entries(MOD_TAG_PRESETS).map(([key, preset]) => (
              <button key={key} className="btn btn-chip" title={preset.description} onClick={() => applyPreset(preset.tags)}>
                {preset.label}
              </button>
            ))}
            <button className="btn btn-chip" onClick={enableAll}>
              Enable all
            </button>
            <button className="btn btn-chip" onClick={disableAll}>
              Disable all
            </button>
          </div>

          <div className="mod-list">
            {filteredMods.length === 0 && (
              <p className="empty-hint">
                No mods yet. Click "Import your mods" to add the .jar files from your existing mods folder - they'll
                show up here as toggles.
              </p>
            )}
            {filteredMods.map((mod) => (
              <ModRow
                key={mod.id}
                mod={mod}
                onToggle={(enabled) => handleToggle(mod, enabled)}
                onRemove={() => handleRemove(mod)}
                onConfigure={() => openConfig(mod)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "console" && <ConsoleLog lines={logLines} />}

      {tab === "settings" && (
        <div className="settings-panel">
          <label className="field">
            <span>Instance name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>

          <label className="field">
            <span>Offline username</span>
            <input
              className="input"
              value={draft.offlineUsername}
              onChange={(e) => setDraft({ ...draft, offlineUsername: e.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Min RAM (MB)</span>
              <input
                className="input"
                type="number"
                value={draft.jvm.minRamMb}
                onChange={(e) => setDraft({ ...draft, jvm: { ...draft.jvm, minRamMb: Number(e.target.value) } })}
              />
            </label>
            <label className="field">
              <span>Max RAM (MB)</span>
              <input
                className="input"
                type="number"
                value={draft.jvm.maxRamMb}
                onChange={(e) => setDraft({ ...draft, jvm: { ...draft.jvm, maxRamMb: Number(e.target.value) } })}
              />
            </label>
          </div>

          <label className="field">
            <span>Java executable path (blank = use "java" on PATH)</span>
            <input
              className="input"
              value={draft.jvm.javaPath}
              onChange={(e) => setDraft({ ...draft, jvm: { ...draft.jvm, javaPath: e.target.value } })}
            />
          </label>

          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={draft.jvm.useSmoothPvpFlags}
              onChange={(e) => setDraft({ ...draft, jvm: { ...draft.jvm, useSmoothPvpFlags: e.target.checked } })}
            />
            <span>Use smooth-PvP GC tuning (reduces stutter/frame hitches during fights)</span>
          </label>

          <label className="field">
            <span>Extra JVM args</span>
            <input
              className="input"
              value={draft.jvm.extraArgs}
              onChange={(e) => setDraft({ ...draft, jvm: { ...draft.jvm, extraArgs: e.target.value } })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Window width</span>
              <input
                className="input"
                type="number"
                value={draft.window.width}
                onChange={(e) => setDraft({ ...draft, window: { ...draft.window, width: Number(e.target.value) } })}
              />
            </label>
            <label className="field">
              <span>Window height</span>
              <input
                className="input"
                type="number"
                value={draft.window.height}
                onChange={(e) => setDraft({ ...draft, window: { ...draft.window, height: Number(e.target.value) } })}
              />
            </label>
          </div>

          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={draft.window.fullscreen}
              onChange={(e) => setDraft({ ...draft, window: { ...draft.window, fullscreen: e.target.checked } })}
            />
            <span>Launch fullscreen</span>
          </label>

          <div className="settings-actions">
            <button className="btn btn-primary" onClick={saveDraft}>
              Save
            </button>
            <button className="btn btn-danger" onClick={onDeleted}>
              Delete instance
            </button>
          </div>
        </div>
      )}

      {configTarget && (
        <ConfigModal
          modName={configTarget.modName}
          filePath={configTarget.filePath}
          format={configTarget.format}
          initialData={configTarget.data}
          onClose={() => setConfigTarget(null)}
        />
      )}
    </div>
  );
}
