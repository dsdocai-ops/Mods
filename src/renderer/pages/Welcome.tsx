// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import SponsorCard from "../components/SponsorCard";
import { SPONSOR_PLACEMENTS } from "@shared/affiliates";

interface Props {
  onNewInstance: () => void;
}

export default function Welcome({ onNewInstance }: Props) {
  return (
    <div className="welcome">
      <p className="welcome-kicker">Welcome</p>
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
