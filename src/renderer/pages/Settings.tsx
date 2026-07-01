import { useEffect, useState } from "react";
import type { AppSettings } from "@shared/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [javaCandidates, setJavaCandidates] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.java.detect().then(setJavaCandidates);
  }, []);

  if (!settings) return <div className="settings-panel">Loading&hellip;</div>;

  const save = async () => {
    await window.api.settings.set(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="settings-panel">
      <h1>Launcher Settings</h1>
      <p className="instance-subtitle">These are the defaults applied to newly created instances.</p>

      <label className="field">
        <span>Default offline username</span>
        <input
          className="input"
          value={settings.defaultOfflineUsername}
          onChange={(e) => setSettings({ ...settings, defaultOfflineUsername: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Default Java executable</span>
        <select
          className="input"
          value={settings.defaultJvm.javaPath}
          onChange={(e) => setSettings({ ...settings, defaultJvm: { ...settings.defaultJvm, javaPath: e.target.value } })}
        >
          <option value="">Use "java" on PATH</option>
          {javaCandidates.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Default min RAM (MB)</span>
          <input
            className="input"
            type="number"
            value={settings.defaultJvm.minRamMb}
            onChange={(e) =>
              setSettings({ ...settings, defaultJvm: { ...settings.defaultJvm, minRamMb: Number(e.target.value) } })
            }
          />
        </label>
        <label className="field">
          <span>Default max RAM (MB)</span>
          <input
            className="input"
            type="number"
            value={settings.defaultJvm.maxRamMb}
            onChange={(e) =>
              setSettings({ ...settings, defaultJvm: { ...settings.defaultJvm, maxRamMb: Number(e.target.value) } })
            }
          />
        </label>
      </div>

      <label className="field-checkbox">
        <input
          type="checkbox"
          checked={settings.defaultJvm.useSmoothPvpFlags}
          onChange={(e) =>
            setSettings({ ...settings, defaultJvm: { ...settings.defaultJvm, useSmoothPvpFlags: e.target.checked } })
          }
        />
        <span>Enable smooth-PvP GC tuning by default</span>
      </label>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
        {saved && <span className="saved-hint">Saved</span>}
      </div>
    </div>
  );
}
