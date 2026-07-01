import { useState } from "react";
import type { DetectedVersion, Instance } from "@shared/types";

interface Props {
  onClose: () => void;
  onCreated: (instance: Instance) => void;
}

export default function NewInstanceDialog({ onClose, onCreated }: Props) {
  const [gameDir, setGameDir] = useState("");
  const [versions, setVersions] = useState<DetectedVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DetectedVersion | null>(null);
  const [name, setName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('No installed versions found in that folder. Pick the folder that contains "versions", "libraries" and "assets" (your .minecraft directory).');
      }
    } finally {
      setScanning(false);
    }
  };

  const create = async () => {
    if (!selectedVersion) return;
    const instance = await window.api.instances.create({
      name: name.trim() || selectedVersion.versionId,
      gameDir,
      versionId: selectedVersion.versionId,
      loader: selectedVersion.loader,
    });
    onCreated(instance);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Instance</h2>

        <label className="field">
          <span>Minecraft install folder</span>
          <div className="field-row">
            <input className="input" value={gameDir} readOnly placeholder="Pick your .minecraft (or MultiMC instance) folder" />
            <button className="btn btn-secondary" onClick={pickGameDir}>
              Browse
            </button>
          </div>
        </label>

        {scanning && <p className="empty-hint">Scanning for installed versions...</p>}
        {error && <p className="error-text">{error}</p>}

        {versions.length > 0 && (
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
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!selectedVersion} onClick={create}>
            Create Instance
          </button>
        </div>
      </div>
    </div>
  );
}
