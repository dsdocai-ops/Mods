# Stripe verify function (deploy this yourself)

This is the missing piece behind Omega Client's Cosmetics redeem flow
(`src/main/licensing.ts`'s `redeemLicenseKey()`). It is **not** part of the
launcher build and is **not deployed for you** - it's your own small
serverless function, holding your own Stripe secret key, that you deploy
under your own account. The launcher only ever talks to the URL you deploy
this to; it never talks to Stripe directly (a Stripe *secret* key must never
ship inside a distributed desktop app - it can issue refunds and read
customer data, unlike a publishable key).

## Why a server is unavoidable here

Stripe doesn't offer a Gumroad-style "verify this license key" endpoint you
can call with a public key. Checking whether a Checkout Session actually paid
requires your secret key, so a minimal stateless function is the smallest
possible amount of infrastructure that does this safely - no database, no
webhook, no persistent server: it just asks Stripe "did this session pay?"
each time someone redeems.

## Setup

1. **Create a Product + Price in the Stripe Dashboard** for your cosmetic
   (Products -> Add product). Note the Price id (starts with `price_`).
2. **Create a Payment Link** for that price (Payment links -> New). Under
   "After payment", choose "Don't show confirmation page" and set the
   redirect URL to `https://<your-deployment>/thank-you.html?session_id={CHECKOUT_SESSION_ID}`
   - Stripe substitutes `{CHECKOUT_SESSION_ID}` for the real session id at
     checkout time. `public/thank-you.html` in this folder reads it back out
     of the URL and displays it for the buyer to copy.
3. **Fill in `cosmetic-price-map.json`** in this folder: map that Price id to
   a cosmetic id from `mod/common/.../presence/CosmeticCatalog.java` (e.g.
   `"price_1AbC...": "gold_badge"`). One line per cosmetic you sell.
4. **Deploy to Vercel** (simplest free option; the logic in `api/verify.js`
   is plain Node and portable to Cloudflare Workers/Netlify Functions with
   minor request/response-object changes if you'd rather use those):
   ```bash
   cd server/stripe-verify
   npm install
   npx vercel deploy --prod
   ```
   Set the `STRIPE_SECRET_KEY` environment variable in the Vercel project
   settings (Settings -> Environment Variables) to your Stripe secret key
   (starts with `sk_live_`/`sk_test_`) - **never commit this key**.
5. **Paste the deployed URL + `/api/verify`** (e.g.
   `https://your-project.vercel.app/api/verify`) into the launcher's
   Settings -> Cosmetics -> "Stripe verify endpoint URL" field and hit Save.
6. **Test it**: buy your own Price in Stripe test mode (test card
   `4242 4242 4242 4242`), copy the session id off the thank-you page, paste
   it into the launcher's License key field, hit Redeem.

## What this does and doesn't guard against

- A session id only ever unlocks the cosmetic tied to the price that was
  actually paid for - `api/verify.js` looks up `session.payment_status` and
  the real line-item price against your own map, it never trusts a
  client-supplied cosmetic id.
- Redeeming the same valid session id twice just re-confirms the same
  cosmetic (`unlockCosmetic()` on the launcher side is idempotent) - no
  double-charge risk since this function never charges anything, only reads.
- Cosmetic ownership is still self-reported into each instance's
  `config/omega-client.json` once unlocked (see `ModConfig.java`'s
  `ownedCosmeticId` javadoc) - same trust model as every other toggle in this
  app. This function is what gates *unlocking* it in the first place, not an
  anti-tamper layer on the mod side.
