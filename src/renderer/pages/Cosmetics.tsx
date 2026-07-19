// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { CosmeticType } from "@shared/cosmetics";
import { COSMETIC_CATALOG, COSMETIC_TYPE_LABELS, STRIPE_COSMETIC_PAYMENT_LINK_URL, cosmeticById } from "@shared/cosmetics";
import { CapeGlyph, HatGlyph, WingsGlyph } from "../components/Icons";
import { toast } from "../toast";

/** Renders the right silhouette for a cosmetic type, tinted to its color. Badges have no gear shape - a plain swatch. */
function CosmeticGlyph({ type, color, size }: { type: CosmeticType; color: string; size: number }) {
  if (type === "cape") return <CapeGlyph size={size} color={color} />;
  if (type === "wings") return <WingsGlyph size={size} color={color} />;
  if (type === "hat") return <HatGlyph size={size} color={color} />;
  return <span className="cosmetic-swatch-badge" style={{ background: color, width: size * 0.7, height: size * 0.7 }} />;
}

const TYPE_ORDER: CosmeticType[] = ["badge", "hat", "cape", "wings"];

/**
 * The Cosmetics screen (sidebar > Cosmetics). A player wears at most one cosmetic overall
 * (mod/common/.../presence/CosmeticCatalog and ModConfig.ownedCosmeticId - no per-slot loadout,
 * unlike an earlier design this replaced). Buy opens the Stripe link, redeem validates a license
 * key and equips it, and any other owned cosmetic can be clicked to switch back to it.
 */
export default function Cosmetics() {
  const [owned, setOwned] = useState<string[]>([]);
  const [equippedId, setEquippedId] = useState<string>("");
  const [licenseKey, setLicenseKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const reload = () =>
    Promise.all([window.api.licensing.listOwned(), window.api.licensing.getActive()]).then(([o, active]) => {
      setOwned(o);
      setEquippedId(active);
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

  /** Re-equip an already-owned cosmetic - unowned cards open the buy link instead (handled by the caller). */
  const equip = async (cosmeticId: string) => {
    try {
      await window.api.licensing.equip(cosmeticId);
      toast(`${cosmeticById(cosmeticId)?.name ?? cosmeticId} equipped`, "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const equipped = equippedId ? cosmeticById(equippedId) : undefined;

  return (
    <div className="settings-panel">
      <p className="welcome-kicker">Cosmetics</p>
      <h1 className="page-title">Cosmetics</h1>
      <p className="instance-subtitle">
        A cosmetic other Omega Client players see on you in-game - a colored name badge, or a hat/cape/wings on your
        player model (needs a server/proxy relaying the presence channel). Buy one, redeem the license key
        you&rsquo;re given, then equip it. You wear one at a time.
      </p>

      <div className="cosmetic-preview">
        <span className="cosmetic-preview-hat">
          {equipped ? (
            <CosmeticGlyph type={equipped.type} color={equipped.colorHex} size={34} />
          ) : (
            <span className="cosmetic-preview-none">&mdash;</span>
          )}
        </span>
        <div>
          <p className="cosmetic-preview-label">Equipped</p>
          <p className="cosmetic-preview-name">{equipped ? equipped.name : "Nothing"}</p>
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
                const isActive = equippedId === cosmetic.id;
                return (
                  <button
                    key={cosmetic.id}
                    className={`cosmetic-card ${isActive ? "cosmetic-card-active" : ""} ${isOwned ? "" : "cosmetic-card-locked"}`}
                    onClick={() =>
                      isOwned ? (isActive ? undefined : equip(cosmetic.id)) : window.api.external.open(STRIPE_COSMETIC_PAYMENT_LINK_URL)
                    }
                    title={cosmetic.description}
                  >
                    <span className="cosmetic-swatch">
                      <CosmeticGlyph type={cosmetic.type} color={cosmetic.colorHex} size={30} />
                    </span>
                    <span className="cosmetic-name">{cosmetic.name}</span>
                    <span className="cosmetic-state">{isActive ? "Active" : isOwned ? "Equip" : "Buy"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

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
