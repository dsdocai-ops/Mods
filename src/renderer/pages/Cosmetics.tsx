// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { CosmeticType } from "@shared/cosmetics";
import {
  COSMETIC_CATALOG,
  COSMETIC_TYPE_LABELS,
  DEFAULT_BADGE_HEX,
  STRIPE_COSMETIC_PAYMENT_LINK_URL,
  cosmeticById,
} from "@shared/cosmetics";
import { CapeGlyph, HatGlyph, WingsGlyph } from "../components/Icons";
import { toast } from "../toast";

/** Renders the right silhouette for a cosmetic type, tinted to its color. */
function CosmeticGlyph({ type, color, size }: { type: CosmeticType; color: string; size: number }) {
  if (type === "cape") return <CapeGlyph size={size} color={color} />;
  if (type === "wings") return <WingsGlyph size={size} color={color} />;
  return <HatGlyph size={size} color={color} />;
}

const TYPE_ORDER: CosmeticType[] = ["hat", "cape", "wings"];

/**
 * The Cosmetics screen (sidebar > Cosmetics). Cosmetics come in three types worn on the player -
 * hats (head), capes and wings (back) - grouped here with a live color preview and owned/active
 * state. One is active at a time (the mod broadcasts a single cosmetic id); buy opens the Stripe
 * link, redeem validates a license key and unlocks.
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
      const name = cosmeticId === "" ? "No cosmetic" : cosmeticById(cosmeticId)?.name ?? cosmeticId;
      toast(`${name} is now active`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const activeCosmetic = active ? cosmeticById(active) : undefined;
  const activeColor = activeCosmetic?.colorHex ?? DEFAULT_BADGE_HEX;

  return (
    <div className="settings-panel">
      <p className="welcome-kicker">Cosmetics</p>
      <h1 className="page-title">Cosmetics</h1>
      <p className="instance-subtitle">
        Cosmetics other Omega Client players see on you in-game - hats on your head, capes and wings on your back
        (needs a server/proxy relaying the presence channel). Buy one, redeem the license key you&rsquo;re given, then
        pick which to wear. One cosmetic is active at a time.
      </p>

      <div className="cosmetic-preview">
        <span className="cosmetic-preview-hat">
          {activeCosmetic ? (
            <CosmeticGlyph type={activeCosmetic.type} color={activeColor} size={38} />
          ) : (
            <span className="cosmetic-preview-none">&mdash;</span>
          )}
        </span>
        <div>
          <p className="cosmetic-preview-label">Active cosmetic</p>
          <p className="cosmetic-preview-name">{activeCosmetic?.name ?? "None"}</p>
        </div>
      </div>

      {TYPE_ORDER.map((type) => {
        const items = COSMETIC_CATALOG.filter((c) => c.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="settings-subheading">{COSMETIC_TYPE_LABELS[type]}</h3>
            <div className="cosmetic-grid">
              {items.map((cosmetic) => {
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
                      <CosmeticGlyph type={cosmetic.type} color={cosmetic.colorHex} size={30} />
                    </span>
                    <span className="cosmetic-name">{cosmetic.name}</span>
                    <span className="cosmetic-state">{isActive ? "Active" : isOwned ? "Use" : "Buy"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <h3 className="settings-subheading">Worn cosmetic</h3>
      <div className="cosmetic-grid">
        <button className={`cosmetic-card ${active === "" ? "cosmetic-card-active" : ""}`} onClick={() => choose("")}>
          <span className="cosmetic-swatch cosmetic-swatch-none">&mdash;</span>
          <span className="cosmetic-name">None</span>
          <span className="cosmetic-state">{active === "" ? "Active" : "Use"}</span>
        </button>
      </div>

      <h3 className="settings-subheading">Redeem a license key</h3>
      <p className="instance-subtitle">Bought a cosmetic? Paste the key you were given to unlock it.</p>
      <div className="field-row">
        <label className="field">
          <span>License key</span>
          <input
            className="input"
            placeholder="e.g. crimson_cape-a1b2c3d4e5f6"
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
