// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConfigFormat, Instance, ModInfo, ModTag, PublicAccount } from "@shared/types";
import { MOD_TAG_PRESETS } from "@shared/types";
import ModRow from "../components/ModRow";
import ConsoleLog from "../components/ConsoleLog";
import ConfigModal from "../components/ConfigModal";
import AccountSwitcher from "../components/AccountSwitcher";
import ShadersPanel from "../components/ShadersPanel";
import { toast } from "../toast";

// The bundled Omega mod's own config (config/omega-client.json) is meant to be edited in-game
// only (Right Shift, or the Ω button in the pause menu) - the generic editor below infers form
// fields purely from JSON shape, with no per-field type/range validation, and a value it happily
// accepts (e.g. a decimal typed into an int field) crashes the mod's config load on next launch.
// Fabric and Forge ship the mod under different mod ids (see fabric.mod.json / mods.toml).
const BUNDLED_OMEGA_MOD_IDS = ["omega-client", "omega_client_forge"];

// Small per-tab glyphs (stroke="currentColor" so they pick up the tab's own text color for free -
// dim when inactive, red when active) - the tab bar used to be indistinguishable from a row of
// buttons; a distinct icon per destination is what actually tells them apart at a glance.
function TabIcon({ name }: { name: "mods" | "shaders" | "console" | "settings" }) {
  const common = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6 } as const;
  if (name === "mods") {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="5" height="5" rx="1.2" />
        <rect x="9" y="2" width="5" height="5" rx="1.2" />
        <rect x="2" y="9" width="5" height="5" rx="1.2" />
        <rect x="9" y="9" width="5" height="5" rx="1.2" />
      </svg>
    );
  }
  if (name === "shaders") {
    return (
      <svg {...common} strokeLinejoin="round" strokeLinecap="round">
        <path d="M8 1.5 9.4 5.8 13.5 8 9.4 10.2 8 14.5 6.6 10.2 2.5 8 6.6 5.8Z" />
      </svg>
    );
  }
  if (name === "console") {
    return (
      <svg {...common} strokeLinejoin="round" strokeLinecap="round">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        <path d="M4 6.5 6.5 8.5 4 10.5M8.5 10.5h3.5" />
      </svg>
    );
  }
  return (
    <svg {...common} strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.8v1.7M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.3 3.7l-1.2 1.2M4.9 11.1l-1.2 1.2M12.3 12.3l-1.2-1.2M4.9 4.9 3.7 3.7" />
    </svg>
  );
}

interface Props {
  instance: Instance;
  logLines: string[];
  isRunning: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onInstanceChanged: () => void;
  onDeleted: () => void;
  onOpenGlobalSettings: () => void;
  /** Bumped when the game signals a switch-account request for this instance - see AccountSwitcher. */
  accountSwitchOpenSignal: number;
}

type Tab = "mods" | "shaders" | "console" | "settings";

export default function InstanceDetail({
  instance,
  logLines,
  isRunning,
  onLaunch,
  onStop,
  onInstanceChanged,
  onDeleted,
  onOpenGlobalSettings,
  accountSwitchOpenSignal,
}: Props) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Tab>("mods");
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Instance>(instance);
  const [accounts, setAccounts] = useState<PublicAccount[]>([]);
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

  const loadAccounts = () => window.api.accounts.list().then(setAccounts);

  useEffect(() => {
    loadMods();
    setDraft(instance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, instance.modsDir]);

  useEffect(() => {
    loadAccounts();
  }, []);

  // Guards against out-of-order responses when the account switcher is used twice in quick
  // succession (open menu, pick account, reopen, pick a different one before the first
  // window.api.instances.update resolves) - without it, whichever IPC call happens to land last
  // wins, which isn't necessarily the account the user picked last.
  const accountRequestRef = useRef(0);

  const quickSetAccount = async (accountId: string | undefined) => {
    const requestId = ++accountRequestRef.current;
    const updated = { ...instance, accountId };
    try {
      await window.api.instances.update(updated);
      if (requestId !== accountRequestRef.current) return;
      setDraft((prev) => ({ ...prev, accountId }));
      onInstanceChanged();
    } catch (err) {
      if (requestId !== accountRequestRef.current) return;
      toast(`Couldn't switch account: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const filteredMods = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return mods;
    return mods.filter((m) => m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)));
  }, [mods, filter]);

  // Every mods.* call below returns the mod list's full new state and setMods() replaces it
  // wholesale - fine when calls resolve in the order they were made, but toggling a mod then
  // quickly applying a preset (or any other overlapping pair) can have the responses land out of
  // order, and the last one to arrive would otherwise win over the last one the user actually
  // triggered. This ref lets each call check "is my response still the newest thing in flight"
  // before committing it.
  const modsRequestRef = useRef(0);

  const handleImport = async () => {
    const paths = await window.api.dialog.pickJarFiles();
    if (paths.length === 0) return;
    const requestId = ++modsRequestRef.current;
    try {
      const updated = await window.api.mods.import(instance.modsDir, paths);
      if (requestId === modsRequestRef.current) setMods(updated);
    } catch (err) {
      toast(`Couldn't import mods: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  // useCallback-stable and shared by every row - together with ModRow's memo(), rows skip
  // re-rendering while unrelated parent state changes (log streaming, filter typing).
  const handleToggle = useCallback(
    async (mod: ModInfo, enabled: boolean) => {
      setMods((prev) => prev.map((m) => (m.id === mod.id ? { ...m, enabled } : m)));
      const requestId = ++modsRequestRef.current;
      try {
        const updated = await window.api.mods.setEnabled(instance.modsDir, mod.id, enabled);
        if (requestId === modsRequestRef.current) setMods(updated);
      } catch (err) {
        // The optimistic flip above is now out of sync with disk - resync instead of leaving a
        // toggle showing a state that silently failed to actually apply.
        if (requestId === modsRequestRef.current) loadMods();
        toast(`Couldn't ${enabled ? "enable" : "disable"} ${mod.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    },
    [instance.modsDir]
  );

  const handleRemove = useCallback(
    async (mod: ModInfo) => {
      const requestId = ++modsRequestRef.current;
      try {
        const updated = await window.api.mods.remove(instance.modsDir, mod.id);
        if (requestId === modsRequestRef.current) setMods(updated);
      } catch (err) {
        toast(`Couldn't remove ${mod.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    },
    [instance.modsDir]
  );

  const openConfig = useCallback(
    async (mod: ModInfo) => {
      if (BUNDLED_OMEGA_MOD_IDS.includes(mod.modId)) {
        toast(`${mod.name}'s settings are edited in-game only (Right Shift, or the Ω button in the pause menu).`, "info");
        return;
      }
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
    },
    [instance.modsDir]
  );

  const applyPreset = async (tags: ModTag[]) => {
    const requestId = ++modsRequestRef.current;
    try {
      const updated = await window.api.mods.applyPreset(instance.modsDir, tags);
      if (requestId === modsRequestRef.current) setMods(updated);
    } catch (err) {
      toast(`Couldn't apply preset: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const enableAll = async () => {
    const changes = Object.fromEntries(mods.filter((m) => !m.enabled).map((m) => [m.id, true]));
    const requestId = ++modsRequestRef.current;
    try {
      const updated = await window.api.mods.setEnabledBulk(instance.modsDir, changes);
      if (requestId === modsRequestRef.current) setMods(updated);
    } catch (err) {
      toast(`Couldn't enable all mods: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const disableAll = async () => {
    const changes = Object.fromEntries(mods.filter((m) => m.enabled).map((m) => [m.id, false]));
    const requestId = ++modsRequestRef.current;
    try {
      const updated = await window.api.mods.setEnabledBulk(instance.modsDir, changes);
      if (requestId === modsRequestRef.current) setMods(updated);
    } catch (err) {
      toast(`Couldn't disable all mods: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const saveDraft = async () => {
    try {
      await window.api.instances.update(draft);
      onInstanceChanged();
      toast("Instance settings saved", "success");
    } catch (err) {
      toast(`Couldn't save instance settings: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
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
          <AccountSwitcher
            instance={instance}
            accounts={accounts}
            onAccountChange={quickSetAccount}
            onAccountsChanged={loadAccounts}
            onManageAccounts={onOpenGlobalSettings}
            openSignal={accountSwitchOpenSignal}
          />
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
          <TabIcon name="mods" />
          Mods
        </button>
        <button className={tab === "shaders" ? "tab active" : "tab"} onClick={() => setTab("shaders")}>
          <TabIcon name="shaders" />
          Shaders
        </button>
        <button className={tab === "console" ? "tab active" : "tab"} onClick={() => setTab("console")}>
          <TabIcon name="console" />
          Console
        </button>
        <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>
          <TabIcon name="settings" />
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
              <ModRow key={mod.id} mod={mod} onToggle={handleToggle} onRemove={handleRemove} onConfigure={openConfig} />
            ))}
          </div>
        </div>
      )}

      {tab === "shaders" && <ShadersPanel modsDir={instance.modsDir} />}

      {tab === "console" && <ConsoleLog lines={logLines} />}

      {tab === "settings" && (
        <div className="settings-panel">
          <label className="field">
            <span>Instance name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>

          <label className="field">
            <span>Account</span>
            <select
              className="input"
              value={draft.accountId ?? ""}
              onChange={(e) => setDraft({ ...draft, accountId: e.target.value || undefined })}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.username} (Microsoft)
                </option>
              ))}
            </select>
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
            <button className="btn btn-danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting..." : "Delete instance"}
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
