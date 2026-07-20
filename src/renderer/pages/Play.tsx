// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { Instance } from "@shared/types";
import ProfilePicker from "../components/ProfilePicker";
import GrassBlockIcon from "../components/GrassBlockIcon";
import { ModsIcon, SettingsIcon } from "../components/Icons";

interface Props {
  instances: Instance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onNewInstance: () => void;
  isRunning: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onOpenMods: () => void;
  onOpenInstanceSettings: () => void;
}

export default function Play({
  instances,
  selectedInstanceId,
  onSelectInstance,
  onNewInstance,
  isRunning,
  onLaunch,
  onStop,
  onOpenMods,
  onOpenInstanceSettings,
}: Props) {
  const selected = instances.find((i) => i.id === selectedInstanceId) ?? null;

  return (
    <div className="play-page">
      <h1>Play</h1>

      <div className="play-card">
        <div className="play-card-art">
          <GrassBlockIcon size={72} />
        </div>
        <div className="play-card-body">
          <div className="play-card-title-row">
            <div>
              <h2>{selected ? selected.name : "No instance selected"}</h2>
              <p className="instance-subtitle">{selected ? `${selected.versionId} · ${selected.loader}` : "Create an instance to get started"}</p>
            </div>
            <ProfilePicker
              instances={instances}
              selectedId={selectedInstanceId}
              onSelect={onSelectInstance}
              onNewInstance={onNewInstance}
              variant="button"
            />
          </div>

          <div className="play-quick-actions">
            <button className="play-quick-action" disabled={!selected} onClick={onOpenMods}>
              <ModsIcon />
              <span>Manage mods</span>
            </button>
            <button className="play-quick-action" disabled={!selected} onClick={onOpenInstanceSettings}>
              <SettingsIcon />
              <span>Instance settings</span>
            </button>
          </div>
        </div>
      </div>

      <div className="play-launch-row">
        {isRunning ? (
          <button className="btn btn-danger btn-play home-play-btn" onClick={onStop}>
            ■ Stop
          </button>
        ) : (
          <button className="btn btn-primary btn-play home-play-btn" disabled={!selected} onClick={onLaunch}>
            &#9654; Play
          </button>
        )}
      </div>
    </div>
  );
}
