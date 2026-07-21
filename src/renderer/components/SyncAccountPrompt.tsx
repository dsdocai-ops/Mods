// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
interface Props {
  instanceName: string;
  /** Pre-highlights the recommended answer as the primary button, matching Settings' "Sync account across instances" default. */
  defaultSync: boolean;
  onChoose: (sync: boolean) => void;
}

/**
 * Shown right after creating an instance (App.tsx), but only when at least one other instance
 * already exists - syncing has nothing to join otherwise. Lets a player opt this one instance out
 * of account syncing (e.g. an alt-account instance) without having to dig into Settings first.
 */
export default function SyncAccountPrompt({ instanceName, defaultSync, onChoose }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Sync account for {instanceName}?</h2>
        <p className="instance-subtitle">
          When synced, switching the signed-in account on any synced instance switches it on all of them - handy if
          you always play as the same account. You can change this later in Settings.
        </p>
        <div className="modal-actions">
          <button className={`btn ${defaultSync ? "btn-ghost" : "btn-primary"}`} onClick={() => onChoose(false)}>
            No, keep independent
          </button>
          <button className={`btn ${defaultSync ? "btn-primary" : "btn-ghost"}`} onClick={() => onChoose(true)}>
            Yes, sync account
          </button>
        </div>
      </div>
    </div>
  );
}
