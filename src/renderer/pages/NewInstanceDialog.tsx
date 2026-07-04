// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { DetectedVersion, InstallableVersion, Instance } from "@shared/types";
import { toast } from "../toast";

interface Props {
  onClose: () => void;
  onCreated: (instance: Instance) => void;
}

type Mode = "existing" | "install";
type InstallLoader = "vanilla" | "fabric" | "forge";

export default function NewInstanceDialog({ onClose, onCreated }: Props) {
  const [gameDir, setGameDir] = useState("");
  const [mode, setMode] = useState<Mode>("existing");
  const [versions, setVersions] = useState<DetectedVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DetectedVersion | null>(null);
  const [name, setName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [releases, setReleases] = useState<InstallableVersion[]>([]);
  const [installVersion, setInstallVersion] = useState("");
  const [installLoader, setInstallLoader] = useState<InstallLoader>("fabric");
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState("");
  const [installPct, setInstallPct] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    return window.api.install.onProgress((progress) => {
      setInstallStatus(progress.detail);
      setInstallPct(progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null);
    });
  }, []);

  const pickGameDir = async () => {
    const dir = await window.api.dialog.pickDirectory();
    if (!dir) return;
    setGameDir(dir);
    setScanning(true);
    setError(null);
    try {
      const found = await window.api.instances.detectVersions(dir);
      setVersions(found);
      if (found.length === 0) {
        // An empty folder isn't an error anymore - it's the "install fresh" starting point.
        setMode("install");
        loadReleases();
      }
    } catch (err) {
      setError(`Couldn't scan that folder: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const loadReleases = async () => {
    if (releases.length > 0) return;
    try {
      const list = await window.api.install.listVersions();
      setReleases(list);
      if (list.length > 0) setInstallVersion(list[0].id);
    } catch (err) {
      setError(`Couldn't fetch the Minecraft version list: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    if (next === "install") loadReleases();
  };

  const runInstall = async () => {
    if (!gameDir || !installVersion || installing) return;
    setInstalling(true);
    setError(null);
    setInstallStatus("Starting...");
    setInstallPct(null);
    try {
      const newVersionId = await window.api.install.start(gameDir, installVersion, installLoader);
      const found = await window.api.instances.detectVersions(gameDir);
      setVersions(found);
      setSelectedVersion(found.find((v) => v.versionId === newVersionId) ?? null);
      setMode("existing");
      toast(`Installed ${newVersionId}`, "success");
    } catch (err) {
      setError(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstalling(false);
    }
  };

  const create = async () => {
    if (!selectedVersion || creating) return;
    setCreating(true);
    try {
      const instance = await window.api.instances.create({
        name: name.trim() || selectedVersion.versionId,
        gameDir,
        versionId: selectedVersion.versionId,
        loader: selectedVersion.loader,
      });
      onCreated(instance);
    } catch (err) {
      // Without this, a main-process failure (e.g. the mods folder can't be created in a read-only
      // install dir) rejects silently and the dialog just appears to do nothing.
      setError(`Couldn't create the instance: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={installing || creating ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Instance</h2>

        <label className="field">
          <span>Minecraft folder</span>
          <div className="field-row">
            <input
              className="input"
              value={gameDir}
              readOnly
              placeholder="Pick your .minecraft folder - or any empty folder to install into"
            />
            <button className="btn btn-secondary" disabled={installing || scanning} onClick={pickGameDir}>
              Browse
            </button>
          </div>
        </label>

        {scanning && <p className="empty-hint">Scanning for installed versions...</p>}

        {gameDir && !scanning && (
          <div className="mode-toggle">
            <button
              className={`btn btn-chip ${mode === "existing" ? "active" : ""}`}
              disabled={installing}
              onClick={() => switchMode("existing")}
            >
              Use installed version ({versions.length})
            </button>
            <button
              className={`btn btn-chip ${mode === "install" ? "active" : ""}`}
              disabled={installing}
              onClick={() => switchMode("install")}
            >
              Install new version
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {mode === "existing" && versions.length === 0 && gameDir && !scanning && (
          <p className="empty-hint">Nothing installed in that folder yet - switch to "Install new version".</p>
        )}

        {mode === "existing" && versions.length > 0 && (
          <label className="field">
            <span>Installed version</span>
            <select
              className="input"
              value={selectedVersion?.versionId ?? ""}
              onChange={(e) => setSelectedVersion(versions.find((v) => v.versionId === e.target.value) ?? null)}
            >
              <option value="" disabled>
                Choose a version&hellip;
              </option>
              {versions.map((v) => (
                <option key={v.versionId} value={v.versionId}>
                  {v.versionId} ({v.loader})
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === "install" && gameDir && (
          <>
            <div className="field-row">
              <label className="field">
                <span>Minecraft version</span>
                <select
                  className="input"
                  disabled={installing || releases.length === 0}
                  value={installVersion}
                  onChange={(e) => setInstallVersion(e.target.value)}
                >
                  {releases.length === 0 && <option value="">Loading versions&hellip;</option>}
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Mod loader</span>
                <select
                  className="input"
                  disabled={installing}
                  value={installLoader}
                  onChange={(e) => setInstallLoader(e.target.value as InstallLoader)}
                >
                  <option value="fabric">Fabric (recommended for the Omega mod)</option>
                  <option value="forge">Forge</option>
                  <option value="vanilla">Vanilla (no mods)</option>
                </select>
              </label>
            </div>

            {installing && (
              <div className="install-progress">
                <div className="progress-track">
                  <div
                    className={`progress-fill ${installPct === null ? "indeterminate" : ""}`}
                    style={installPct !== null ? { width: `${installPct}%` } : undefined}
                  />
                </div>
                <p className="install-status">{installStatus}</p>
              </div>
            )}

            <button className="btn btn-primary" disabled={installing || !installVersion} onClick={runInstall}>
              {installing ? "Installing..." : `Install ${installVersion || ""} ${installLoader !== "vanilla" ? `+ ${installLoader}` : ""}`}
            </button>
          </>
        )}

        <label className="field">
          <span>Instance name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selectedVersion?.versionId ?? "My PvP Instance"}
          />
        </label>

        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={installing || creating} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!selectedVersion || installing || creating} onClick={create}>
            {creating ? "Creating..." : "Create Instance"}
          </button>
        </div>
      </div>
    </div>
  );
}
