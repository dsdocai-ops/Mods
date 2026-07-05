// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Vercel serverless function (module.exports = (req, res) => ...) - the reference implementation
// for src/main/licensing.ts's redeemLicenseKey(). Deploy this yourself (see README.md); the
// launcher never talks to Stripe directly, since a Stripe secret key must never live in a
// distributed desktop client (it can issue refunds and read customer data).
//
// Request:  POST { "sessionId": "cs_live_..." }
// Response: 200 { "ok": boolean, "cosmeticId"?: string, "message": string } - always HTTP 200 with
// ok:false for any *expected* failure (unpaid session, unmapped price, bad input) so the launcher's
// fetch().json() always has something valid to parse; only a genuine transport error on the
// launcher's end surfaces as a different message there (see licensing.ts's catch around fetch()).
const Stripe = require("stripe");
const priceMap = require("../cosmetic-price-map.json");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed - POST only." });
    return;
  }

  const sessionId = req.body?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    res.status(200).json({ ok: false, message: "That doesn't look like a Stripe Checkout Session id (should start with cs_)." });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(200).json({ ok: false, message: "Server misconfigured: STRIPE_SECRET_KEY isn't set." });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });

    if (session.payment_status !== "paid") {
      res.status(200).json({ ok: false, message: "This checkout session hasn't completed payment yet." });
      return;
    }

    const priceId = session.line_items?.data?.[0]?.price?.id;
    const cosmeticId = priceId ? priceMap[priceId] : undefined;
    if (!cosmeticId) {
      res.status(200).json({ ok: false, message: "Payment confirmed, but this price isn't mapped to a known cosmetic yet." });
      return;
    }

    res.status(200).json({ ok: true, cosmeticId, message: `Unlocked: ${cosmeticId}` });
  } catch (err) {
    res.status(200).json({ ok: false, message: `Stripe lookup failed: ${err instanceof Error ? err.message : String(err)}` });
  }
};
