// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { CosmeticType } from "@shared/cosmetics";
import { COSMETIC_CATALOG, COSMETIC_TYPE_LABELS, STRIPE_COSMETIC_PAYMENT_LINK_URL, cosmeticById } from "@shared/cosmetics";
import { CapeGlyph, HatGlyph, WingsGlyph } from "../components/Icons";
import CoinShopModal from "../components/CoinShopModal";
import { toast } from "../toast";
import coinIcon from "../assets/coin.png";

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
  const [coins, setCoins] = useState(0);
  const [coinCode, setCoinCode] = useState("");
  const [redeemingCoins, setRedeemingCoins] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  const reload = () =>
    Promise.all([window.api.licensing.listOwned(), window.api.licensing.getActive(), window.api.coins.getBalance()])
      .then(([o, active, balance]) => {
        setOwned(o);
        setEquippedId(active);
        setCoins(balance);
      })
      .catch(() => {});

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

  /** Re-equip an already-owned cosmetic - unowned cards spend coins instead (handled by the caller). */
  const equip = async (cosmeticId: string) => {
    try {
      await window.api.licensing.equip(cosmeticId);
      toast(`${cosmeticById(cosmeticId)?.name ?? cosmeticId} equipped`, "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  /** Spends coins to unlock+equip a cosmetic directly, no license key involved. */
  const purchaseWithCoins = async (cosmeticId: string) => {
    setPurchasingId(cosmeticId);
    try {
      const result = await window.api.coins.purchaseCosmetic(cosmeticId);
      if (typeof result.coins === "number") setCoins(result.coins);
      toast(result.message, result.ok ? "success" : "info");
      if (result.ok) reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setPurchasingId(null);
    }
  };

  const redeemCoinCode = async () => {
    if (!coinCode.trim()) return;
    setRedeemingCoins(true);
    try {
      const result = await window.api.coins.redeem(coinCode.trim());
      toast(result.message, result.ok ? "success" : "info");
      if (typeof result.coins === "number") setCoins(result.coins);
      if (result.ok) setCoinCode("");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRedeemingCoins(false);
    }
  };

  const equipped = equippedId ? cosmeticById(equippedId) : undefined;

  return (
    <div className="settings-panel">
      <div className="cosmetics-header-row">
        <div>
          <p className="welcome-kicker">Cosmetics</p>
          <h1 className="page-title">Cosmetics</h1>
        </div>
        <button className="coin-balance" title="Buy more coins" onClick={() => setShopOpen(true)}>
          <img src={coinIcon} alt="" className="coin-icon" />
          <span>{coins.toLocaleString()}</span>
        </button>
      </div>

      {shopOpen && <CoinShopModal onClose={() => setShopOpen(false)} />}
      <p className="instance-subtitle">
        A cosmetic other Omega Client players see on you in-game - a colored name badge, or a hat/cape/wings on your
        player model (needs a server/proxy relaying the presence channel). Spend coins to unlock one directly, then
        equip it. You wear one at a time.
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
                const isPurchasing = purchasingId === cosmetic.id;
                return (
                  <button
                    key={cosmetic.id}
                    className={`cosmetic-card ${isActive ? "cosmetic-card-active" : ""} ${isOwned ? "" : "cosmetic-card-locked"}`}
                    disabled={isPurchasing}
                    onClick={() => (isOwned ? (isActive ? undefined : equip(cosmetic.id)) : purchaseWithCoins(cosmetic.id))}
                    title={cosmetic.description}
                  >
                    <span className="cosmetic-swatch">
                      <CosmeticGlyph type={cosmetic.type} color={cosmetic.colorHex} size={30} />
                    </span>
                    <span className="cosmetic-name">{cosmetic.name}</span>
                    <span className="cosmetic-state">
                      {isActive ? (
                        "Active"
                      ) : isOwned ? (
                        "Equip"
                      ) : isPurchasing ? (
                        "..."
                      ) : (
                        <span className="cosmetic-price">
                          <img src={coinIcon} alt="" className="coin-icon-tiny" />
                          {cosmetic.coinPrice.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <h3 className="settings-subheading">Get coins</h3>
      <p className="instance-subtitle">Buy a coin pack, then paste the code you&rsquo;re given here to add it to your balance.</p>
      <div className="field-row">
        <label className="field">
          <span>Coin code</span>
          <input
            className="input"
            placeholder="e.g. coins:500-9f1c2a3b4d5e6f70-a1b2c3d4e5f6"
            value={coinCode}
            onChange={(e) => setCoinCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") redeemCoinCode();
            }}
          />
        </label>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={() => setShopOpen(true)}>
            Buy coins
          </button>
          <button className="btn btn-secondary" disabled={redeemingCoins || !coinCode.trim()} onClick={redeemCoinCode}>
            {redeemingCoins ? "Redeeming..." : "Redeem"}
          </button>
        </div>
      </div>

      <h3 className="settings-subheading">Redeem a license key</h3>
      <p className="instance-subtitle">
        Bought a cosmetic directly with real money instead of coins? Paste the key you were given to unlock it. (
        <button className="link-inline" onClick={() => window.api.external.open(STRIPE_COSMETIC_PAYMENT_LINK_URL)}>
          buy one directly
        </button>
        )
      </p>
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
