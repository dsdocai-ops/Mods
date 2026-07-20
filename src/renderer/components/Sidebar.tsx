// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { memo } from "react";
import { HomeIcon, PlayIcon, ModsIcon, CosmeticsIcon, SettingsIcon, AboutIcon, GitHubIcon } from "./Icons";

export type NavKey = "home" | "play" | "mods" | "cosmetics" | "settings" | "about";

const NAV_ITEMS: { key: NavKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "play", label: "Play", Icon: PlayIcon },
  { key: "mods", label: "Mods", Icon: ModsIcon },
  { key: "cosmetics", label: "Cosmetics", Icon: CosmeticsIcon },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
  { key: "about", label: "About", Icon: AboutIcon },
];

interface Props {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}

// Memoized: App re-renders on every batched log flush while a game is running, but the sidebar's
// own props (active nav + a stable onNavigate callback) don't change then.
function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">Ω</span>
          <span className="brand-wordmark">OMEGA</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <button key={key} className={`sidebar-nav-item ${active === key ? "active" : ""}`} onClick={() => onNavigate(key)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-social" title="GitHub" onClick={() => window.api.external.open("https://github.com/dsdocai-ops/Mods")}>
          <GitHubIcon />
        </button>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
