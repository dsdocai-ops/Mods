// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import { STRIPE_COSMETIC_PAYMENT_LINK_URL } from "@shared/cosmetics";
import { toast } from "../toast";

export default function CosmeticsPage() {
  const [ownedCosmetics, setOwnedCosmetics] = useState<string[]>([]);
  const [licenseKey, setLicenseKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const loadOwnedCosmetics = () => window.api.licensing.listOwned().then(setOwnedCosmetics);

  useEffect(() => {
    loadOwnedCosmetics();
  }, []);

  const redeemLicenseKey = async () => {
    if (!licenseKey.trim()) return;
    setRedeeming(true);
    try {
      const result = await window.api.licensing.redeem(licenseKey.trim());
      toast(result.message, result.ok ? "success" : "info");
      if (result.ok) {
        setLicenseKey("");
        loadOwnedCosmetics();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="settings-panel">
      <h1>Cosmetics</h1>
      <p className="instance-subtitle">
        A cosmetic badge other Omega Client players see next to your name in-game (same mechanism as the free Ω
        badge - needs a server/proxy relaying the presence channel). Buy one, then redeem the license key you're
        given below.
      </p>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={() => window.api.external.open(STRIPE_COSMETIC_PAYMENT_LINK_URL)}>
          Buy a cosmetic
        </button>
      </div>

      <h3 className="settings-subheading">Owned</h3>
      <div className="account-list">
        {ownedCosmetics.length === 0 && <p className="empty-hint">No cosmetics owned yet.</p>}
        {ownedCosmetics.map((cosmeticId) => (
          <div key={cosmeticId} className="account-row">
            <span className="account-name">{cosmeticId}</span>
            <span className="badge badge-installed">Installed</span>
          </div>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          <span>License key</span>
          <input
            className="input"
            placeholder="paste the license key you were given"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
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
