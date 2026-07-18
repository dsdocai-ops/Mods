// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { ActiveSlots, CosmeticType } from "@shared/cosmetics";
import {
  COSMETIC_CATALOG,
  COSMETIC_TYPE_LABELS,
  EMPTY_ACTIVE_SLOTS,
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
 * The Cosmetics screen (sidebar > Cosmetics). Cosmetics come in three slots worn together - a hat
 * (head), a cape and wings (back). You equip one per slot; the mod broadcasts all three and draws
 * them at once. Buy opens the Stripe link, redeem validates a license key and unlocks + equips.
 */
export default function Cosmetics() {
  const [owned, setOwned] = useState<string[]>([]);
  const [slots, setSlots] = useState<ActiveSlots>(EMPTY_ACTIVE_SLOTS);
  const [licenseKey, setLicenseKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const reload = () =>
    Promise.all([window.api.licensing.listOwned(), window.api.licensing.getActiveSlots()]).then(([o, s]) => {
      setOwned(o);
      setSlots(s);
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

  /** Equip (or clear, with "") a cosmetic in its slot, leaving the other slots as they are. */
  const equip = async (type: CosmeticType, cosmeticId: string) => {
    try {
      const next = await window.api.licensing.setActiveSlot(type, cosmeticId);
      setSlots(next);
      const name = cosmeticId === "" ? `No ${type}` : cosmeticById(cosmeticId)?.name ?? cosmeticId;
      toast(cosmeticId === "" ? `${COSMETIC_TYPE_LABELS[type].replace(/s$/, "")} slot cleared` : `${name} equipped`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const equipped = TYPE_ORDER.map((t) => slots[t]).filter(Boolean).map((id) => cosmeticById(id)!).filter(Boolean);

  return (
    <div className="settings-panel">
      <p className="welcome-kicker">Cosmetics</p>
      <h1 className="page-title">Cosmetics</h1>
      <p className="instance-subtitle">
        Cosmetics other Omega Client players see on you in-game - a hat on your head, a cape and wings on your back
        (needs a server/proxy relaying the presence channel). Buy one, redeem the license key you&rsquo;re given, then
        equip it. You can wear one of each slot at once.
      </p>

      <div className="cosmetic-preview">
        <span className="cosmetic-preview-hat">
          {equipped.length > 0 ? (
            <span className="cosmetic-preview-stack">
              {equipped.map((c) => (
                <CosmeticGlyph key={c.id} type={c.type} color={c.colorHex} size={34} />
              ))}
            </span>
          ) : (
            <span className="cosmetic-preview-none">&mdash;</span>
          )}
        </span>
        <div>
          <p className="cosmetic-preview-label">Equipped</p>
          <p className="cosmetic-preview-name">{equipped.length > 0 ? equipped.map((c) => c.name).join(" + ") : "Nothing"}</p>
        </div>
      </div>

      {TYPE_ORDER.map((type) => {
        const items = COSMETIC_CATALOG.filter((c) => c.type === type);
        if (items.length === 0) return null;
        const slotActive = slots[type];
        return (
          <div key={type}>
            <h3 className="settings-subheading">{COSMETIC_TYPE_LABELS[type]}</h3>
            <div className="cosmetic-grid">
              {/* Per-slot "None" to take this slot off without touching the others. */}
              <button
                className={`cosmetic-card ${slotActive === "" ? "cosmetic-card-active" : ""}`}
                onClick={() => equip(type, "")}
              >
                <span className="cosmetic-swatch cosmetic-swatch-none">&mdash;</span>
                <span className="cosmetic-name">None</span>
                <span className="cosmetic-state">{slotActive === "" ? "Active" : "Off"}</span>
              </button>

              {items.map((cosmetic) => {
                const isOwned = owned.includes(cosmetic.id);
                const isActive = slotActive === cosmetic.id;
                return (
                  <button
                    key={cosmetic.id}
                    className={`cosmetic-card ${isActive ? "cosmetic-card-active" : ""} ${isOwned ? "" : "cosmetic-card-locked"}`}
                    onClick={() =>
                      isOwned ? equip(type, cosmetic.id) : window.api.external.open(STRIPE_COSMETIC_PAYMENT_LINK_URL)
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
