// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Instance, PublicAccount } from "@shared/types";
import { SPONSOR_PLACEMENTS } from "@shared/affiliates";
import { RELEASES_URL } from "@shared/links";
import SponsorCard from "../components/SponsorCard";
import { ArrowRightIcon, ChevronDownIcon, CubeIcon, GearIcon, PlayIcon } from "../components/Icons";

interface Props {
  instances: Instance[];
  accounts: PublicAccount[];
  runningIds: Set<string>;
  onNewInstance: () => void;
  /** Opens the instance's detail view (mods/settings tabs). */
  onOpenInstance: (id: string) => void;
  onLaunch: (instance: Instance) => void;
  onStop: (instance: Instance) => void;
}

// Launcher release notes shown in the RECENT NEWS panel. "View all" opens the releases page, so
// only the latest entry or two need to live here.
const NEWS = [
  {
    title: "Omega v1.0.0 - Initial Release",
    body: "The beginning of something great.",
    date: "May 18, 2024",
  },
];

/**
 * Stable cover-art banner variant (0-3) from a hash of the instance id - the mini profile thumb
 * uses the same four hue variants as the Play page's banner cards.
 */
function bannerVariant(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % 4;
}

/**
 * The launcher's landing screen, recreated from the Omega home mockup: welcome header, a
 * SELECTED PROFILE dropdown (profiles = this launcher's instances), the big PLAY button, a
 * RECENT NEWS panel, and the OMEGA hero panel on the right.
 */
export default function Home({ instances, accounts, runningIds, onNewInstance, onOpenInstance, onLaunch, onStop }: Props) {
  // The profile the PLAY button targets. Follows the first instance until the user picks one;
  // reconciles when the picked instance gets deleted.
  const [selectedId, setSelectedId] = useState<string | null>(instances[0]?.id ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => instances.find((i) => i.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId]
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const username = accounts[0]?.username ?? "Player";
  const isRunning = selected ? runningIds.has(selected.id) : false;

  return (
    <div className="home">
      <div className="home-left">
        <p className="welcome-kicker">Welcome back</p>
        <h1 className="home-title">{username}</h1>
        <p className="home-sub">Ready to play Minecraft?</p>

        {instances.length === 0 ? (
          <>
            <p className="home-empty-copy">
              Point the launcher at a Minecraft install you already have set up (vanilla launcher, MultiMC/Prism, or
              any folder with <code>versions/</code>, <code>libraries/</code> and <code>assets/</code>), then toggle
              your mods on and off per-instance without touching files by hand.
            </p>
            <button className="btn btn-primary btn-play" onClick={onNewInstance}>
              Create your first instance
            </button>
          </>
        ) : (
          <>
            <p className="section-label">Selected profile</p>
            <div className="profile-select" ref={menuRef}>
              <button className="profile-card" onClick={() => setMenuOpen((v) => !v)}>
                <span
                  className={`profile-card-icon profile-card-thumb banner-v${bannerVariant(selected?.id ?? "")}`}
                  aria-hidden="true"
                />
                <span className="profile-card-info">
                  <span className="profile-card-name">{selected?.name}</span>
                  <span className="profile-card-meta">
                    {selected?.versionId} &bull; {selected?.loader}
                  </span>
                </span>
                <ChevronDownIcon size={15} />
              </button>

              {menuOpen && (
                <div className="profile-menu">
                  {instances.map((instance) => (
                    <button
                      key={instance.id}
                      className={`profile-menu-item ${instance.id === selected?.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(instance.id);
                        setMenuOpen(false);
                      }}
                    >
                      <CubeIcon size={16} />
                      <span className="profile-card-info">
                        <span className="profile-card-name">{instance.name}</span>
                        <span className="profile-card-meta">
                          {instance.versionId} &bull; {instance.loader}
                        </span>
                      </span>
                      {runningIds.has(instance.id) && <span className="running-dot running-dot-inline" title="Running" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="home-actions">
              {isRunning ? (
                <button className="btn btn-danger btn-play home-play" onClick={() => selected && onStop(selected)}>
                  Stop
                </button>
              ) : (
                <button className="btn btn-primary btn-play home-play" disabled={!selected} onClick={() => selected && onLaunch(selected)}>
                  <PlayIcon size={14} /> Play
                </button>
              )}
              <button
                className="btn btn-icon"
                title="Instance settings & mods"
                disabled={!selected}
                onClick={() => selected && onOpenInstance(selected.id)}
              >
                <GearIcon size={18} />
              </button>
            </div>
          </>
        )}

        <div className="news-panel">
          <div className="news-header">
            <span className="section-label news-header-label">Recent news</span>
            <button className="news-view-all" onClick={() => window.api.external.open(RELEASES_URL)}>
              View all <ArrowRightIcon size={13} />
            </button>
          </div>
          {NEWS.map((item) => (
            <div key={item.title} className="news-row">
              <span className="news-icon">Ω</span>
              <span className="news-info">
                <span className="news-title">{item.title}</span>
                <span className="news-body">{item.body}</span>
              </span>
              <span className="news-date">{item.date}</span>
            </div>
          ))}
        </div>

        {SPONSOR_PLACEMENTS.map((placement) => (
          <SponsorCard key={placement.id} placement={placement} />
        ))}
      </div>

      <div className="home-hero">
        <div className="hero-bg" />
        <div className="hero-aurora" />
        <div className="hero-wordmark">
          <span className="hero-omega">Omega</span>
          <span className="hero-tagline">The ultimate Minecraft client</span>
        </div>
      </div>
    </div>
  );
}
