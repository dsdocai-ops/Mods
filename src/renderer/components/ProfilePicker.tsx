// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef, useState } from "react";
import type { Instance } from "@shared/types";
import { ChevronDownIcon } from "./Icons";

interface Props {
  instances: Instance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewInstance: () => void;
  /** "trigger" renders the compact "Default · 1.20.4 · Fabric ⌄" row from the reference's profile
      card; "button" renders a plain "Change" button - same dropdown, two different launch points
      (the Home dashboard card vs. the Play page's bigger card). */
  variant?: "trigger" | "button";
}

export default function ProfilePicker({ instances, selectedId, onSelect, onNewInstance, variant = "trigger" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = instances.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="profile-picker" ref={rootRef}>
      {variant === "trigger" ? (
        <button className="profile-picker-trigger" onClick={() => setOpen((v) => !v)}>
          <span className="instance-icon" style={{ background: selected?.iconColor ?? "#3a3a40" }}>
            {selected ? selected.name.slice(0, 2).toUpperCase() : "--"}
          </span>
          <span className="profile-picker-text">
            <span className="profile-picker-name">{selected ? selected.name : "No profile yet"}</span>
            <span className="profile-picker-meta">{selected ? `${selected.versionId} · ${selected.loader}` : "Create an instance to get started"}</span>
          </span>
          <ChevronDownIcon className="profile-picker-chevron" />
        </button>
      ) : (
        <button className="btn btn-secondary" onClick={() => setOpen((v) => !v)}>
          Change
        </button>
      )}

      {open && (
        <div className="profile-picker-menu">
          {instances.map((instance) => (
            <button
              key={instance.id}
              className={`profile-picker-item ${instance.id === selectedId ? "active" : ""}`}
              onClick={() => {
                onSelect(instance.id);
                setOpen(false);
              }}
            >
              <span className="instance-icon" style={{ background: instance.iconColor }}>
                {instance.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="profile-picker-text">
                <span className="profile-picker-name">{instance.name}</span>
                <span className="profile-picker-meta">
                  {instance.versionId} &middot; {instance.loader}
                </span>
              </span>
            </button>
          ))}
          {instances.length === 0 && <p className="empty-hint" style={{ padding: "8px 12px" }}>No instances yet.</p>}
          <div className="account-switcher-divider" />
          <button
            className="profile-picker-item"
            onClick={() => {
              setOpen(false);
              onNewInstance();
            }}
          >
            + New Instance
          </button>
        </div>
      )}
    </div>
  );
}
