interface Props {
  onNewInstance: () => void;
}

export default function Welcome({ onNewInstance }: Props) {
  return (
    <div className="welcome">
      <h1>ForgePvP Launcher</h1>
      <p>
        Point the launcher at a Minecraft install you already have set up (vanilla launcher, MultiMC/Prism, or any
        folder with <code>versions/</code>, <code>libraries/</code> and <code>assets/</code>), then toggle your mods
        on and off per-instance without touching files by hand.
      </p>
      <button className="btn btn-primary" onClick={onNewInstance}>
        Create your first instance
      </button>
    </div>
  );
}
