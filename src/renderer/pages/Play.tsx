// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { Instance } from "@shared/types";
import { CubeIcon, GearIcon, PlayIcon, PlusIcon } from "../components/Icons";

interface Props {
  instances: Instance[];
  runningIds: Set<string>;
  onNewInstance: () => void;
  /** Opens an instance's detail view (mods / shaders / console / settings tabs). */
  onOpenInstance: (id: string) => void;
  onLaunch: (instance: Instance) => void;
  onStop: (instance: Instance) => void;
}

/**
 * Picks one of four cover-art banner variants from a stable hash of the instance id (sum of char
 * codes mod 4), so each instance gets a consistent hue without needing per-instance artwork.
 */
function bannerVariant(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % 4;
}

/**
 * The Play screen - this launcher's instances hub, reached from the sidebar's Play item. It lists
 * every instance as a card (select to open its detail, launch inline) and is the primary place to
 * create new instances via the "New Instance" card.
 */
export default function Play({ instances, runningIds, onNewInstance, onOpenInstance, onLaunch, onStop }: Props) {
  return (
    <div className="play-page">
      <header className="page-header">
        <div>
          <p className="welcome-kicker">Play</p>
          <h1 className="page-title">Your instances</h1>
          <p className="home-sub">Pick an instance to launch, or create a new one.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewInstance}>
          <PlusIcon size={15} /> New Instance
        </button>
      </header>

      <div className="instance-grid">
        {instances.map((instance) => {
          const running = runningIds.has(instance.id);
          return (
            <div key={instance.id} className={`instance-card ${running ? "running" : ""}`}>
              <div className="instance-card-banner">
                <div className={`instance-card-banner-img banner-fill banner-v${bannerVariant(instance.id)}`} />
              </div>
              <button className="instance-card-main" onClick={() => onOpenInstance(instance.id)}>
                <span className="instance-card-icon">
                  <CubeIcon size={22} />
                </span>
                <span className="instance-card-info">
                  <span className="instance-card-name">
                    {instance.name}
                    {running && <span className="running-dot running-dot-inline" title="Running" />}
                  </span>
                  <span className="instance-card-meta">
                    {instance.versionId} &bull; {instance.loader}
                  </span>
                </span>
              </button>
              <div className="instance-card-actions">
                {running ? (
                  <button className="btn btn-danger btn-sm" onClick={() => onStop(instance)}>
                    Stop
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => onLaunch(instance)}>
                    <PlayIcon size={12} /> Play
                  </button>
                )}
                <button className="btn btn-icon btn-icon-sm" title="Manage instance" onClick={() => onOpenInstance(instance.id)}>
                  <GearIcon size={16} />
                </button>
              </div>
            </div>
          );
        })}

        <button className="instance-card instance-card-new" onClick={onNewInstance}>
          <span className="instance-card-new-icon">
            <PlusIcon size={22} />
          </span>
          <span className="instance-card-new-label">New Instance</span>
          <span className="instance-card-new-hint">Install a version or import an existing Minecraft folder</span>
        </button>
      </div>
    </div>
  );
}
