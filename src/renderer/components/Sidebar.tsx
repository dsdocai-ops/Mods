// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { memo } from "react";
import { DISCORD_URL, GITHUB_URL, WEBSITE_URL } from "@shared/links";
import {
  DiscordIcon,
  GearIcon,
  GitHubIcon,
  GlobeIcon,
  HomeIcon,
  InfoIcon,
  PlayIcon,
  PuzzleIcon,
  ShirtIcon,
} from "./Icons";

// The sidebar's fixed nav keys - one per item in the design mockup's sidebar.
export type NavKey = "home" | "play" | "mods" | "cosmetics" | "settings" | "about";

interface Props {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}

const NAV_ITEMS: { key: NavKey; label: string; icon: (size: number) => JSX.Element }[] = [
  { key: "home", label: "Home", icon: (s) => <HomeIcon size={s} /> },
  { key: "play", label: "Play", icon: (s) => <PlayIcon size={s} /> },
  { key: "mods", label: "Mods", icon: (s) => <PuzzleIcon size={s} /> },
  { key: "cosmetics", label: "Cosmetics", icon: (s) => <ShirtIcon size={s} /> },
  { key: "settings", label: "Settings", icon: (s) => <GearIcon size={s} /> },
  { key: "about", label: "About", icon: (s) => <InfoIcon size={s} /> },
];

// Memoized: App re-renders on every batched log flush while a game is running, but the sidebar's
// props (active nav + stable handler) don't change then.
function Sidebar({ active, onNavigate }: Props) {
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
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`instance-item ${active === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="instance-icon">{item.icon(18)}</span>
            <span className="instance-info">
              <span className="instance-name">{item.label}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-social">
          <button className="social-btn" title="Discord" onClick={() => window.api.external.open(DISCORD_URL)}>
            <DiscordIcon size={18} />
          </button>
          <button className="social-btn" title="GitHub" onClick={() => window.api.external.open(GITHUB_URL)}>
            <GitHubIcon size={18} />
          </button>
          <button className="social-btn" title="Website" onClick={() => window.api.external.open(WEBSITE_URL)}>
            <GlobeIcon size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
