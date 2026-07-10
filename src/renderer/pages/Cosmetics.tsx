// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import { COSMETIC_CATALOG, DEFAULT_BADGE_HEX, STRIPE_COSMETIC_PAYMENT_LINK_URL, cosmeticById } from "@shared/cosmetics";
import { HatGlyph } from "../components/Icons";
import { toast } from "../toast";

/**
 * The Cosmetics screen (sidebar > Cosmetics). Shows the catalog of Ω badges with a live color
 * preview, which ones you own, and lets you pick which owned one is broadcast in-game (the mod only
 * shows one at a time). Buy opens the Stripe link; redeem validates a license key and unlocks.
 */
export default function Cosmetics() {
  const [owned, setOwned] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [licenseKey, setLicenseKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const reload = () =>
    Promise.all([window.api.licensing.listOwned(), window.api.licensing.getActive()]).then(([o, a]) => {
      setOwned(o);
      setActive(a);
    });

  useEffect(() => {
    reload();
  }, []);

  const redeemLicenseKey = async () => {
    if (!licenseKey.trim()) return;
    setRedeeming(true);
    try {
      const result = await window.api.licensing.redeem(licenseKey.trim());
      toast(result.message, result.ok ? "success" : "info");
      if (result.ok) {
        setLicenseKey("");
        reload();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRedeeming(false);
    }
  };

  const choose = async (cosmeticId: string) => {
    try {
      await window.api.licensing.setActive(cosmeticId);
      setActive(cosmeticId);
      const name = cosmeticId === "" ? "Default badge" : cosmeticById(cosmeticId)?.name ?? cosmeticId;
      toast(`${name} is now active`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const activeColor = active ? cosmeticById(active)?.colorHex ?? DEFAULT_BADGE_HEX : DEFAULT_BADGE_HEX;
  const activeName = active ? cosmeticById(active)?.name ?? active : "Default badge";

  return (
    <div className="settings-panel">
      <p className="welcome-kicker">Cosmetics</p>
      <h1 className="page-title">Cosmetics</h1>
      <p className="instance-subtitle">
        A colored hat worn on your head in-game (with a matching Ω name badge) that other Omega Client players see -
        needs a server/proxy relaying the presence channel. Buy one, redeem the license key you&rsquo;re given, then
        choose which owned hat is active.
      </p>

      <div className="cosmetic-preview">
        <span className="cosmetic-preview-hat">
          {active ? <HatGlyph size={38} color={activeColor} /> : <span className="cosmetic-preview-none">&mdash;</span>}
        </span>
        <div>
          <p className="cosmetic-preview-label">Active hat</p>
          <p className="cosmetic-preview-name">{activeName}</p>
        </div>
      </div>

      <h3 className="settings-subheading">Hats</h3>
      <div className="cosmetic-grid">
        {/* No hat is always available to switch back to. */}
        <button
          className={`cosmetic-card ${active === "" ? "cosmetic-card-active" : ""}`}
          onClick={() => choose("")}
        >
          <span className="cosmetic-swatch cosmetic-swatch-none">&mdash;</span>
          <span className="cosmetic-name">No hat</span>
          <span className="cosmetic-state">{active === "" ? "Active" : "Use"}</span>
        </button>

        {COSMETIC_CATALOG.map((cosmetic) => {
          const isOwned = owned.includes(cosmetic.id);
          const isActive = active === cosmetic.id;
          return (
            <button
              key={cosmetic.id}
              className={`cosmetic-card ${isActive ? "cosmetic-card-active" : ""} ${isOwned ? "" : "cosmetic-card-locked"}`}
              onClick={() =>
                isOwned ? choose(cosmetic.id) : window.api.external.open(STRIPE_COSMETIC_PAYMENT_LINK_URL)
              }
              title={cosmetic.description}
            >
              <span className="cosmetic-swatch">
                <HatGlyph size={30} color={cosmetic.colorHex} />
              </span>
              <span className="cosmetic-name">{cosmetic.name}</span>
              <span className="cosmetic-state">{isActive ? "Active" : isOwned ? "Use" : "Buy"}</span>
            </button>
          );
        })}
      </div>

      <h3 className="settings-subheading">Redeem a license key</h3>
      <p className="instance-subtitle">Bought a cosmetic? Paste the key you were given to unlock it.</p>
      <div className="field-row">
        <label className="field">
          <span>License key</span>
          <input
            className="input"
            placeholder="e.g. gold_badge-a1b2c3d4e5f6"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") redeemLicenseKey();
            }}
          />
        </label>
        <div className="settings-actions">
          <button className="btn btn-secondary" disabled={redeeming || !licenseKey.trim()} onClick={redeemLicenseKey}>
            {redeeming ? "Redeeming..." : "Redeem"}
          </button>
        </div>
      </div>
    </div>
  );
}
