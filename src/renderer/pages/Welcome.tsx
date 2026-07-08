// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import SponsorCard from "../components/SponsorCard";
import { SPONSOR_PLACEMENTS } from "@shared/affiliates";

interface Props {
  onNewInstance: () => void;
}

/**
 * A small inline hero illustration - a glowing gradient orb behind the Ω mark with a few floating
 * accent particles - rather than a shipped image file (there's no network in this app to fetch a
 * real photo/illustration from, and the CSP wouldn't allow a remote one anyway; an inline SVG is
 * the one kind of "image" that's genuinely free - no asset file, scales perfectly, themeable).
 */
function WelcomeHero() {
  return (
    <svg className="welcome-hero" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="heroGrad" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b8cff" />
          <stop offset="55%" stopColor="#9061f9" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9061f9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#9061f9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#heroGlow)" />
      <circle cx="60" cy="60" r="38" fill="url(#heroGrad)" />
      <circle cx="20" cy="30" r="5" fill="#22d3ee" opacity="0.85" />
      <circle cx="102" cy="42" r="4" fill="#ec4899" opacity="0.85" />
      <circle cx="94" cy="98" r="6" fill="#5b8cff" opacity="0.85" />
      <text x="60" y="72" textAnchor="middle" fontSize="34" fontWeight="800" fill="#ffffff" fontFamily="Segoe UI, system-ui, sans-serif">
        Ω
      </text>
    </svg>
  );
}

export default function Welcome({ onNewInstance }: Props) {
  return (
    <div className="welcome">
      <WelcomeHero />
      <h1>Omega Client</h1>
      <p className="welcome-verse">
        &ldquo;I am the Alpha and the Omega, the first and the last, the beginning and the end&rdquo;
        &mdash; Revelation 22:13
      </p>
      <p className="welcome-slogan">The last client you will ever need.</p>
      <p>
        Point the launcher at a Minecraft install you already have set up (vanilla launcher, MultiMC/Prism, or any
        folder with <code>versions/</code>, <code>libraries/</code> and <code>assets/</code>), then toggle your mods
        on and off per-instance without touching files by hand.
      </p>
      <button className="btn btn-primary" onClick={onNewInstance}>
        Create your first instance
      </button>

      {SPONSOR_PLACEMENTS.map((placement) => (
        <SponsorCard key={placement.id} placement={placement} />
      ))}
    </div>
  );
}
