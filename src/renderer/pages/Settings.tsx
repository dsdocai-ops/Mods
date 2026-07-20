// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { AppSettings, PublicAccount } from "@shared/types";
import { SPONSOR_PLACEMENTS } from "@shared/affiliates";
import SponsorCard from "../components/SponsorCard";
import { toast } from "../toast";

interface Props {
  /** Called whenever the linked-account list changes (add/remove) - lets App.tsx's sign-in gate react immediately if the last account gets removed. */
  onAccountsChanged?: () => void;
}

export default function SettingsPage({ onAccountsChanged }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [javaCandidates, setJavaCandidates] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [accounts, setAccounts] = useState<PublicAccount[]>([]);
  const [signingIn, setSigningIn] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const loadAccounts = () =>
    window.api.accounts.list().then((list) => {
      setAccounts(list);
      onAccountsChanged?.();
    });

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.java.detect().then(setJavaCandidates);
    loadAccounts();
  }, []);

  if (!settings) return <div className="settings-panel">Loading&hellip;</div>;

  const save = async () => {
    try {
      await window.api.settings.set(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      toast(`Couldn't save settings: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const addMicrosoftAccount = async () => {
    if (!settings.msaClientId.trim()) {
      toast("Add a Microsoft sign-in client ID below first (see README for how to register one).", "info");
      return;
    }
    setSigningIn(true);
    try {
      await window.api.settings.set(settings);
      const account = await window.api.accounts.addMicrosoft();
      toast(`Signed in as ${account.username}`, "success");
      loadAccounts();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSigningIn(false);
    }
  };

  const removeAccount = async (account: PublicAccount) => {
    try {
      await window.api.accounts.remove(account.id);
      toast(`Removed ${account.username}`, "info");
      loadAccounts();
    } catch (err) {
      toast(`Couldn't remove ${account.username}: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const result = await window.api.updates.checkNow();
      if (result === "unsupported") {
        toast("Auto-update isn't available in this build (dev run or portable exe) - re-download from the Releases page instead.", "info");
      } else if (result === "ready") {
        toast("Update downloaded - a restart banner will appear.", "success");
      } else if (result === "downloading") {
        toast("Update found - downloading in the background, a restart banner will appear when it's ready.", "info");
      } else if (result === "checked") {
        toast("You're on the latest build.", "success");
      } else {
        toast("Couldn't check for updates - check your network connection.", "error");
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="settings-panel">
      <h1>Launcher Settings</h1>

      <h3 className="settings-subheading">Microsoft Accounts</h3>
      <p className="instance-subtitle">
        A Minecraft account is required to play - sign-in works out of the box below. Add more accounts here if you
        play as more than one, or paste your own Azure app registration's client ID to use instead of the shipped
        default (see the README's "Microsoft sign-in" section).
      </p>

      <label className="field">
        <span>Microsoft sign-in client ID</span>
        <input
          className="input"
          placeholder="paste your own Azure app's Application (client) ID to override the shipped default"
          value={settings.msaClientId}
          onChange={(e) => setSettings({ ...settings, msaClientId: e.target.value })}
        />
      </label>

      <div className="account-list">
        {accounts.length === 0 && <p className="empty-hint">No Microsoft accounts linked yet.</p>}
        {accounts.map((account) => (
          <div key={account.id} className="account-row">
            <span className="account-name">{account.username}</span>
            <span className="account-uuid">{account.uuid}</span>
            <button className="btn btn-ghost btn-danger" onClick={() => removeAccount(account)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button className="btn btn-secondary" disabled={signingIn} onClick={addMicrosoftAccount}>
          {signingIn ? "Signing in..." : "+ Add Microsoft Account"}
        </button>
      </div>

      <h3 className="settings-subheading">Instance Defaults</h3>
      <p className="instance-subtitle">Applied to newly created instances.</p>

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

      <h3 className="settings-subheading">Updates</h3>
      <p className="instance-subtitle">
        Only applies to <code>OmegaClient-Setup.exe</code> installs - the portable exe can't replace itself in place,
        so re-download it manually instead.
      </p>

      <label className="field-checkbox">
        <input
          type="checkbox"
          checked={settings.autoUpdateEnabled}
          onChange={(e) => setSettings({ ...settings, autoUpdateEnabled: e.target.checked })}
        />
        <span>Automatically check for updates on startup</span>
      </label>

      <div className="settings-actions">
        <button className="btn btn-secondary" disabled={checkingUpdate} onClick={checkForUpdates}>
          {checkingUpdate ? "Checking..." : "Check for updates now"}
        </button>
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
        {saved && <span className="saved-hint">Saved</span>}
      </div>

      <h3 className="settings-subheading">Recommended</h3>
      {SPONSOR_PLACEMENTS.map((placement) => (
        <SponsorCard key={placement.id} placement={placement} />
      ))}
    </div>
  );
}
