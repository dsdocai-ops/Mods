// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
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

  // Every instance is expected to have an account now that sign-in is required to reach any
  // screen (see App.tsx's SignInRequired gate) - the "no account" fallback only covers an
  // instance somehow left without one (e.g. from before this became mandatory).
  const activeAccount = accounts.find((a) => a.id === instance.accountId);
  const label = activeAccount ? activeAccount.username : "No account selected";

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
        <span className="account-switcher-dot" style={{ background: activeAccount ? "#4caf50" : "#8e8e96" }} />
        {label}
      </button>

      {open && (
        <div className="account-switcher-menu">
          {accounts.map((account) => (
            <button
              key={account.id}
              className={`account-switcher-item ${instance.accountId === account.id ? "active" : ""}`}
              onClick={() => selectAccount(account.id)}
            >
              {account.username}{" "}
              <span className="account-switcher-badge">{account.type === "offline" ? "Offline (testing)" : "Microsoft"}</span>
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
