import { APEX_HOSTING_AFFILIATE_URL, APEX_HOSTING_DISCLOSURE } from "@shared/affiliates";

/**
 * Optional "need a server?" recommendation - Apex Hosting, picked after comparing commission
 * reliability across the major Minecraft host affiliate programs (see the launcher README's
 * Monetization notes). Always paired with an explicit disclosure per FTC-style affiliate rules and
 * Minecraft's own usage guidelines around not implying endorsement.
 */
export default function SponsoredHostCard() {
  const open = () => window.api.external.open(APEX_HOSTING_AFFILIATE_URL);

  return (
    <div className="sponsored-card">
      <div className="sponsored-card-text">
        <span className="sponsored-card-title">Need a practice server?</span>
        <span className="sponsored-card-body">
          Apex Hosting sets up a Minecraft server in minutes - handy for PvP/UHC/Bedwars practice with friends.
        </span>
      </div>
      <button className="btn btn-secondary" onClick={open}>
        Get a server
      </button>
      <p className="sponsored-card-disclosure">{APEX_HOSTING_DISCLOSURE}</p>
    </div>
  );
}
