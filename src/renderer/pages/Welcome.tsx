// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import SponsorCard from "../components/SponsorCard";
import { SPONSOR_PLACEMENTS } from "@shared/affiliates";

interface Props {
  onNewInstance: () => void;
}

/**
 * A hand-drawn isometric grass block - the single most recognizable image in Minecraft - rather
 * than a real screenshot/texture. Two reasons: this app has no network access to fetch a real
 * image from (and the CSP wouldn't allow a remote one anyway), and Mojang's actual textures are
 * copyrighted assets a third-party launcher shouldn't be embedding as decoration. Original pixel-
 * art in the same blocky style reads as "Minecraft" just as well without either problem - the same
 * approach every other third-party launcher's branding takes.
 */
function WelcomeHero() {
  return (
    <svg className="welcome-hero" width="112" height="112" viewBox="0 0 120 120" aria-hidden="true">
      {/* top (grass) face */}
      <polygon points="60,8 100,30 60,52 20,30" fill="#7cbb43" />
      <rect x="34" y="18" width="6" height="6" fill="#8fcf55" opacity="0.8" />
      <rect x="72" y="24" width="5" height="5" fill="#6ba53a" opacity="0.8" />
      <rect x="54" y="30" width="6" height="6" fill="#8fcf55" opacity="0.7" />

      {/* left (dirt, shaded) face */}
      <polygon points="20,30 60,52 60,96 20,74" fill="#6b4423" />
      <rect x="28" y="60" width="6" height="6" fill="#7c5029" opacity="0.8" />
      <rect x="40" y="78" width="7" height="7" fill="#5a3a1d" opacity="0.8" />
      <polygon points="20,30 60,52 60,60 20,38" fill="#5c9e37" />

      {/* right (dirt, lit) face */}
      <polygon points="60,52 100,30 100,74 60,96" fill="#8b5a2b" />
      <rect x="82" y="44" width="6" height="6" fill="#9c6a35" opacity="0.8" />
      <rect x="70" y="70" width="7" height="7" fill="#7a4d24" opacity="0.8" />
      <polygon points="60,52 100,30 100,38 60,60" fill="#6bb63f" />

      {/* small accent spark tying the block to the app's red accent, like an enchant glint */}
      <path d="M100 14 102 20 108 22 102 24 100 30 98 24 92 22 98 20Z" fill="#e5484d" opacity="0.9" />
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
