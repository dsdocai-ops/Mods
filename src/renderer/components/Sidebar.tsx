// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { memo } from "react";
import type { Instance } from "@shared/types";
import { CubeIcon, GearIcon, HomeIcon, PlusIcon } from "./Icons";

interface Props {
  instances: Instance[];
  selectedId: string | null;
  isHome: boolean;
  onHome: () => void;
  onSelect: (id: string) => void;
  onNewInstance: () => void;
  onSettings: () => void;
  runningIds: Set<string>;
}

// Memoized: App re-renders on every batched log flush while a game is running, but none of the
// sidebar's props change then (App passes useCallback-stable handlers to keep this effective).
function Sidebar({ instances, selectedId, isHome, onHome, onSelect, onNewInstance, onSettings, runningIds }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">Ω</span>
          <span className="brand-text">
            <span className="brand-name">Omega</span>
            <span className="brand-slogan">The last client you will ever need.</span>
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button className={`instance-item ${isHome ? "active" : ""}`} onClick={onHome}>
          <span className="instance-icon">
            <HomeIcon size={18} />
          </span>
          <span className="instance-info">
            <span className="instance-name">Home</span>
          </span>
        </button>
      </nav>

      <p className="sidebar-section-label">Instances</p>
      <div className="instance-list">
        {instances.map((instance) => (
          <button
            key={instance.id}
            className={`instance-item ${selectedId === instance.id ? "active" : ""}`}
            onClick={() => onSelect(instance.id)}
          >
            <span className="instance-icon">
              <CubeIcon size={18} />
            </span>
            <span className="instance-info">
              <span className="instance-name">{instance.name}</span>
              <span className="instance-meta">
                {instance.versionId} &middot; {instance.loader}
              </span>
            </span>
            {runningIds.has(instance.id) && <span className="running-dot" title="Running" />}
          </button>
        ))}
        {instances.length === 0 && <p className="empty-hint">No instances yet.</p>}
      </div>

      <div className="sidebar-footer">
        <button className="btn btn-secondary" onClick={onNewInstance}>
          <PlusIcon size={15} /> New Instance
        </button>
        <button className="btn btn-ghost" onClick={onSettings}>
          <GearIcon size={15} /> Settings
        </button>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
