// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/** Purely cosmetic - how big a pile to draw for this pack on the shop card (see CoinShopModal.tsx). Scales with `coins`, nothing else reads it. */
export type CoinStackSize = "sm" | "md" | "lg" | "xl";

/**
 * One buyable coin pack, shown in the shop opened from the Cosmetics page's balance pill
 * (CoinShopModal.tsx). No backend exists yet to verify a Stripe payment and auto-credit the
 * buyer's balance, so "Buy" just opens `stripeUrl` (same restricted-to-`https://` `external:open`
 * path as every other purchase link in this app) and the buyer still redeems the code they're
 * handed afterwards via the Cosmetics page's "Get coins" field (main/wallet.ts) - same manual
 * flow as a single cosmetic's license key today. Swap this out once a backend exists to verify
 * the payment and mint/send the code itself instead of a human doing it.
 */
export interface CoinPack {
  id: string;
  coins: number;
  priceUsd: number;
  stackSize: CoinStackSize;
  /** Shown on the card when set - purely a merchandising hint, not read anywhere else. */
  badge?: "popular" | "best-value";
  stripeUrl: string;
}

/**
 * Coins-per-dollar rises with pack size (100 -> 145/$) - a standard bulk-discount ladder, same
 * shape as most game currency shops. Replace each `stripeUrl` with its own real Stripe Payment
 * Link (a separate product per pack, unlike the single link cosmetics use, since these differ by
 * price) once ready to sell.
 */
export const COIN_PACKS: CoinPack[] = [
  { id: "coins_1000", coins: 1000, priceUsd: 10, stackSize: "sm", stripeUrl: "https://buy.stripe.com/REPLACE_ME_COINS_1000" },
  { id: "coins_2800", coins: 2800, priceUsd: 25, stackSize: "md", stripeUrl: "https://buy.stripe.com/REPLACE_ME_COINS_2800" },
  { id: "coins_6500", coins: 6500, priceUsd: 50, stackSize: "lg", badge: "popular", stripeUrl: "https://buy.stripe.com/REPLACE_ME_COINS_6500" },
  { id: "coins_14500", coins: 14500, priceUsd: 100, stackSize: "xl", badge: "best-value", stripeUrl: "https://buy.stripe.com/REPLACE_ME_COINS_14500" },
];
