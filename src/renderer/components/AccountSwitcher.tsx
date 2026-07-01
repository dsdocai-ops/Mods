import { useEffect, useRef, useState } from "react";
import type { Instance, PublicAccount } from "@shared/types";
import { toast } from "../toast";

interface Props {
  instance: Instance;
  accounts: PublicAccount[];
  onAccountChange: (accountId: string | undefined) => void;
  onAccountsChanged: () => void;
  onManageAccounts: () => void;
  /** Bumped by the parent when the game signals a switch-account request - pops the dropdown open automatically. */
  openSignal: number;
}

export default function AccountSwitcher({ instance, accounts, onAccountChange, onAccountsChanged, onManageAccounts, openSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeAccount = accounts.find((a) => a.id === instance.accountId);
  const label = activeAccount ? activeAccount.username : `Offline: ${instance.offlineUsername}`;

  const selectAccount = (accountId: string | undefined) => {
    onAccountChange(accountId);
    setOpen(false);
  };

  const addMicrosoftAccount = async () => {
    setAddingAccount(true);
    try {
      const account = await window.api.accounts.addMicrosoft();
      toast(`Signed in as ${account.username}`, "success");
      onAccountsChanged();
      selectAccount(account.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setAddingAccount(false);
    }
  };

  return (
    <div className="account-switcher" ref={rootRef}>
      <button className="btn btn-secondary account-switcher-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="account-switcher-dot" style={{ background: activeAccount ? "#4caf50" : "#8a90a3" }} />
        {label}
      </button>

      {open && (
        <div className="account-switcher-menu">
          <button className={`account-switcher-item ${!instance.accountId ? "active" : ""}`} onClick={() => selectAccount(undefined)}>
            Offline: {instance.offlineUsername}
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              className={`account-switcher-item ${instance.accountId === account.id ? "active" : ""}`}
              onClick={() => selectAccount(account.id)}
            >
              {account.username} <span className="account-switcher-badge">Microsoft</span>
            </button>
          ))}
          <div className="account-switcher-divider" />
          <button className="account-switcher-item" disabled={addingAccount} onClick={addMicrosoftAccount}>
            {addingAccount ? "Signing in..." : "+ Add Microsoft Account"}
          </button>
          <button
            className="account-switcher-item"
            onClick={() => {
              setOpen(false);
              onManageAccounts();
            }}
          >
            Manage accounts...
          </button>
        </div>
      )}
    </div>
  );
}
