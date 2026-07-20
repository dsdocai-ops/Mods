// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { Instance, PublicAccount } from "@shared/types";
import ProfilePicker from "../components/ProfilePicker";
import HeroLandscape from "../components/HeroLandscape";
import { SettingsIcon } from "../components/Icons";

interface Props {
  instances: Instance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onNewInstance: () => void;
  accounts: PublicAccount[];
  isRunning: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onOpenInstanceSettings: () => void;
}

export default function Home({
  instances,
  selectedInstanceId,
  onSelectInstance,
  onNewInstance,
  accounts,
  isRunning,
  onLaunch,
  onStop,
  onOpenInstanceSettings,
}: Props) {
  const displayName = accounts[0]?.username ?? "Player";
  const hasSelection = instances.some((i) => i.id === selectedInstanceId);

  return (
    <div className="home-page">
      <div className="home-main">
        <p className="home-eyebrow">Welcome back</p>
        <h1>{displayName}</h1>
        <p className="instance-subtitle">Ready to play Minecraft?</p>

        <p className="home-section-label">Selected profile</p>
        <ProfilePicker instances={instances} selectedId={selectedInstanceId} onSelect={onSelectInstance} onNewInstance={onNewInstance} />

        <div className="home-play-row">
          {isRunning ? (
            <button className="btn btn-danger btn-play home-play-btn" onClick={onStop}>
              ■ Stop
            </button>
          ) : (
            <button className="btn btn-primary btn-play home-play-btn" disabled={!hasSelection} onClick={onLaunch}>
              &#9654; Play
            </button>
          )}
          <button className="btn btn-icon-square" title="Instance settings" disabled={!hasSelection} onClick={onOpenInstanceSettings}>
            <SettingsIcon />
          </button>
        </div>

        <div className="home-news-card">
          <div className="home-news-header">
            <span className="home-section-label" style={{ margin: 0 }}>
              What's new
            </span>
          </div>
          <div className="home-news-item">
            <span className="brand-mark home-news-icon">Ω</span>
            <div className="home-news-text">
              <span className="home-news-title">A cleaner, faster Omega Client</span>
              <span className="instance-subtitle">Redesigned UI, mandatory sign-in for account safety, and a real install-completeness check before every launch.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="home-hero">
        <HeroLandscape className="home-hero-art" />
        <div className="home-hero-overlay">
          <span className="home-hero-wordmark">OMEGA</span>
          <span className="home-hero-tagline">The last client you will ever need.</span>
        </div>
      </div>
    </div>
  );
}
