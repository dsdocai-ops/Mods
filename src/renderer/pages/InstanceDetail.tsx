// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConfigFormat, Instance, ModInfo, ModrinthUpdate, ModTag, PublicAccount } from "@shared/types";
import { MOD_TAG_PRESETS } from "@shared/types";
import ModRow from "../components/ModRow";
import ConsoleLog from "../components/ConsoleLog";
import DiscoverMods from "../components/DiscoverMods";
import { ArrowRightIcon, PlayIcon, PlusIcon, RefreshIcon } from "../components/Icons";
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

interface Props {
  instance: Instance;
  logLines: string[];
  isRunning: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onInstanceChanged: () => void;
  onDeleted: () => void;
  onOpenGlobalSettings: () => void;
  /** Returns to the Play screen (the instances hub this detail view is opened from). */
  onBack: () => void;
  /** Which tab to open on first render - the sidebar's Mods item deep-links straight to "mods". */
  initialTab?: Tab;
  /** Bumped when the game signals a switch-account request for this instance - see AccountSwitcher. */
  accountSwitchOpenSignal: number;
}

export type Tab = "mods" | "shaders" | "console" | "settings";

export default function InstanceDetail({
  instance,
  logLines,
  isRunning,
  onLaunch,
  onStop,
  onInstanceChanged,
  onDeleted,
  onOpenGlobalSettings,
  onBack,
  initialTab = "mods",
  accountSwitchOpenSignal,
}: Props) {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [modsView, setModsView] = useState<"installed" | "discover">("installed");
  const [updates, setUpdates] = useState<ModrinthUpdate[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Instance>(instance);
  const [accounts, setAccounts] = useState<PublicAccount[]>([]);
  const [configTarget, setConfigTarget] = useState<{
    modName: string;
    filePath: string;
    format: ConfigFormat;
    data: Record<string, unknown>;
  } | null>(null);

  // Best-effort update check against Modrinth (hash-lookup). An automatic check (on load) stays
  // silent on failure so an offline machine or a Modrinth outage simply shows no update prompts; a
  // manual check (the "Check for updates" button) surfaces the result - an error toast, or an
  // "up to date" note when nothing's found - so the click visibly did something.
  const checkUpdates = async (manual = false) => {
    setCheckingUpdates(true);
    try {
      const found = await window.api.modrinth.checkUpdates(instance.modsDir, instance.loader, instance.versionId);
      setUpdates(found);
      if (manual && found.length === 0) toast("All mods are up to date", "success");
    } catch (err) {
      if (manual) toast(`Couldn't check for updates: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const loadMods = async () => {
    const list = await window.api.mods.list(instance.modsDir);
    setMods(list);
    checkUpdates();
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

  // Kept current so the useCallback-stable per-row updateOne (needed to preserve ModRow's memo)
  // can read the latest updates/busy state without changing identity every render.
  const updatesRef = useRef<ModrinthUpdate[]>(updates);
  updatesRef.current = updates;
  const bulkUpdatingRef = useRef(bulkUpdating);
  bulkUpdatingRef.current = bulkUpdating;

  const updateByFile = useMemo(() => new Map(updates.map((u) => [u.fileName, u] as const)), [updates]);

  const updateAll = async () => {
    if (updates.length === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    try {
      const result = await window.api.modrinth.applyUpdates(instance.modsDir, updates, instance.loader, instance.versionId);
      const newDeps = result.installedFiles.length - updates.length;
      toast(
        `Updated ${updates.length} mod${updates.length === 1 ? "" : "s"}${newDeps > 0 ? ` (+${newDeps} new dependenc${newDeps === 1 ? "y" : "ies"})` : ""}`,
        "success"
      );
      setUpdates([]);
      await loadMods();
    } catch (err) {
      toast(`Couldn't update mods: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setBulkUpdating(false);
    }
  };

  const updateOne = useCallback(
    async (mod: ModInfo) => {
      const target = updatesRef.current.find((u) => u.fileName === mod.fileName);
      if (!target || bulkUpdatingRef.current) return;
      try {
        const result = await window.api.modrinth.applyUpdates(instance.modsDir, [target], instance.loader, instance.versionId);
        const newDeps = result.installedFiles.length - 1;
        toast(`Updated ${mod.name} to v${target.newVersion}${newDeps > 0 ? ` (+${newDeps} new dependenc${newDeps === 1 ? "y" : "ies"})` : ""}`, "success");
        setUpdates((prev) => prev.filter((u) => u.fileName !== mod.fileName));
        await loadMods();
      } catch (err) {
        toast(`Couldn't update ${mod.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    },
    // instance is stable for this component's life (App keys InstanceDetail by instance.id), so this
    // is effectively a constant identity - exactly what ModRow's memo needs.
    [instance.modsDir] // eslint-disable-line react-hooks/exhaustive-deps
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
      <button className="back-link" onClick={onBack}>
        <span className="back-arrow">
          <ArrowRightIcon size={14} />
        </span>
        Back to Play
      </button>
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
              <PlayIcon size={14} /> Play
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "mods" ? "tab active" : "tab"} onClick={() => setTab("mods")}>
          Mods
        </button>
        <button className={tab === "shaders" ? "tab active" : "tab"} onClick={() => setTab("shaders")}>
          Shaders
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
          <div className="mods-segmented">
            <button
              className={modsView === "installed" ? "seg active" : "seg"}
              onClick={() => setModsView("installed")}
            >
              Installed ({mods.length})
            </button>
            <button
              className={modsView === "discover" ? "seg active" : "seg"}
              onClick={() => setModsView("discover")}
            >
              Discover
            </button>
          </div>

          {modsView === "installed" ? (
            <>
              {updates.length > 0 && (
                <div className="update-bar">
                  <span className="update-bar-label">
                    <RefreshIcon size={15} /> {updates.length} update{updates.length === 1 ? "" : "s"} available from Modrinth
                  </span>
                  <button className="btn btn-primary btn-sm" disabled={bulkUpdating} onClick={updateAll}>
                    {bulkUpdating ? "Updating..." : "Update all"}
                  </button>
                </div>
              )}

              <div className="mods-toolbar">
                <input
                  className="input"
                  placeholder="Search mods or tags (e.g. pvp, performance)"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <button
                  className="btn btn-secondary"
                  disabled={checkingUpdates || bulkUpdating}
                  title="Check Modrinth for newer versions of your installed mods"
                  onClick={() => checkUpdates(true)}
                >
                  <span className={checkingUpdates ? "spin" : undefined}>
                    <RefreshIcon size={14} />
                  </span>
                  {checkingUpdates ? "Checking…" : "Check for updates"}
                </button>
                <button className="btn btn-secondary" onClick={handleImport}>
                  <PlusIcon size={14} /> Import your mods
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
                    No mods yet. Click "Discover" to browse and install mods from Modrinth, or "Import your mods" to add
                    .jar files from your existing mods folder - either way they show up here as toggles.
                  </p>
                )}
                {filteredMods.map((mod) => (
                  <ModRow
                    key={mod.id}
                    mod={mod}
                    onToggle={handleToggle}
                    onRemove={handleRemove}
                    onConfigure={openConfig}
                    updateVersion={updateByFile.get(mod.fileName)?.newVersion}
                    onUpdate={bulkUpdating ? undefined : updateOne}
                  />
                ))}
              </div>
            </>
          ) : (
            <DiscoverMods
              instance={instance}
              installedFileNames={new Set(mods.map((m) => m.id))}
              onInstalled={loadMods}
            />
          )}
        </div>
      )}

      {tab === "shaders" && <ShadersPanel instance={instance} />}

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
