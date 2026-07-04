// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { SponsorPlacement } from "@shared/types";

interface Props {
  placement: SponsorPlacement;
}

/**
 * Renders one native sponsor/affiliate placement (see shared/affiliates.ts's SPONSOR_PLACEMENTS).
 * Always paired with an explicit disclosure per FTC-style affiliate rules and Minecraft's own usage
 * guidelines around not implying endorsement.
 */
export default function SponsorCard({ placement }: Props) {
  const open = () => window.api.external.open(placement.url);

  return (
    <div className="sponsored-card">
      <div className="sponsored-card-text">
        <span className="sponsored-card-title">{placement.title}</span>
        <span className="sponsored-card-body">{placement.body}</span>
      </div>
      <button className="btn btn-secondary" onClick={open}>
        {placement.ctaLabel}
      </button>
      <p className="sponsored-card-disclosure">{placement.disclosure}</p>
    </div>
  );
}
