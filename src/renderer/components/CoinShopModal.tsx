// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { CoinPack, CoinStackSize } from "@shared/coinPacks";
import { COIN_PACKS } from "@shared/coinPacks";
import coinIcon from "../assets/coin.png";

interface StackCoin {
  x: number;
  y: number;
  rotate: number;
}

// Hand-placed offsets for a handful of the same coin icon, arranged into a rough pile - bigger
// packs get more coins and a taller pile. No new art needed, just layering shared/assets/coin.png.
const STACK_LAYOUTS: Record<CoinStackSize, StackCoin[]> = {
  sm: [
    { x: -10, y: 10, rotate: -8 },
    { x: 8, y: 6, rotate: 10 },
    { x: -2, y: -6, rotate: -3 },
  ],
  md: [
    { x: -16, y: 18, rotate: -12 },
    { x: 14, y: 16, rotate: 14 },
    { x: -6, y: 6, rotate: -6 },
    { x: 10, y: 2, rotate: 8 },
    { x: 0, y: -10, rotate: 0 },
  ],
  lg: [
    { x: -20, y: 24, rotate: -14 },
    { x: 18, y: 22, rotate: 16 },
    { x: 0, y: 18, rotate: -4 },
    { x: -12, y: 6, rotate: -8 },
    { x: 12, y: 4, rotate: 10 },
    { x: -2, y: -8, rotate: -2 },
    { x: 4, y: -20, rotate: 6 },
  ],
  xl: [
    { x: -24, y: 30, rotate: -16 },
    { x: 22, y: 28, rotate: 18 },
    { x: -2, y: 26, rotate: -2 },
    { x: -16, y: 10, rotate: -10 },
    { x: 16, y: 8, rotate: 12 },
    { x: 0, y: 4, rotate: 0 },
    { x: -8, y: -10, rotate: -6 },
    { x: 10, y: -12, rotate: 8 },
    { x: 0, y: -28, rotate: 2 },
  ],
};

function CoinStack({ size }: { size: CoinStackSize }) {
  return (
    <div className={`coin-stack coin-stack-${size}`}>
      {STACK_LAYOUTS[size].map((c, i) => (
        <img
          key={i}
          src={coinIcon}
          alt=""
          className="coin-stack-coin"
          style={{ transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rotate}deg)`, zIndex: i }}
        />
      ))}
    </div>
  );
}

const BADGE_LABELS: Record<NonNullable<CoinPack["badge"]>, string> = {
  popular: "Popular",
  "best-value": "Best value",
};

interface Props {
  onClose: () => void;
}

/**
 * Coin pack shop - opened from the Cosmetics page's balance pill (and its "Buy coins" button).
 * Each card's price button just opens that pack's Stripe link (see shared/coinPacks.ts for why:
 * no backend yet to verify payment and auto-credit coins). The buyer still redeems the code
 * they're handed afterwards via the Cosmetics page's "Get coins" field - this modal only replaces
 * picking a link, not the redeem step.
 */
export default function CoinShopModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Coin shop</h2>
        <p className="instance-subtitle">
          Buy a pack, then paste the code you&rsquo;re given into &ldquo;Get coins&rdquo; on the Cosmetics page to add it to your
          balance.
        </p>

        <div className="coin-shop-grid">
          {COIN_PACKS.map((pack) => (
            <div key={pack.id} className="coin-pack-card">
              {pack.badge && <span className={`coin-pack-badge coin-pack-badge-${pack.badge}`}>{BADGE_LABELS[pack.badge]}</span>}
              <CoinStack size={pack.stackSize} />
              <span className="coin-pack-amount">
                <img src={coinIcon} alt="" className="coin-icon-tiny" />
                {pack.coins.toLocaleString()}
              </span>
              <button className="btn btn-primary coin-pack-buy" onClick={() => window.api.external.open(pack.stripeUrl)}>
                ${pack.priceUsd}
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
