// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import GrassBlockIcon from "../components/GrassBlockIcon";
import { GitHubIcon } from "../components/Icons";

export default function About() {
  return (
    <div className="welcome">
      <GrassBlockIcon size={80} className="welcome-hero" />
      <h1>Omega Client</h1>
      <p className="welcome-verse">
        &ldquo;I am the Alpha and the Omega, the first and the last, the beginning and the end&rdquo;
        &mdash; Revelation 22:13
      </p>
      <p className="welcome-slogan">The last client you will ever need.</p>
      <p>
        A lightweight, offline-friendly Minecraft launcher built for instance management, per-instance mod toggles,
        and smooth-PvP performance tuning. The companion Omega mod (Fabric + Forge) ships inside the launcher and is
        installed automatically into every instance.
      </p>
      <p className="instance-subtitle">Version 0.1.0</p>
      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={() => window.api.external.open("https://github.com/dsdocai-ops/Mods")}>
          <GitHubIcon size={16} /> Source on GitHub
        </button>
      </div>
    </div>
  );
}
