import type { SponsorPlacement } from "./types";

/**
 * Third-party recommendations shown in the launcher UI, disclosed as affiliate links wherever they
 * appear (required by FTC guidelines and similar rules elsewhere, and by Minecraft's own usage
 * guidelines around not implying endorsement). See README's "Monetization" section for the full
 * rationale on why Apex specifically.
 *
 * This is native in-launcher content, not a third-party ad network banner - the CSP
 * (`script-src 'self'` in index.html) doesn't allow loading arbitrary remote ad scripts, and most ad
 * networks' own ToS prohibit exactly this kind of desktop-app embedding anyway. Real placements get
 * added to this array as they're set up - not inventing fake ones ahead of time.
 */
export const APEX_HOSTING_AFFILIATE_URL = "https://billing.apexminecrafthosting.com/aff.php?aff=16916";

export const APEX_HOSTING_DISCLOSURE =
  "Affiliate link - Omega Client may earn a commission if you sign up, at no extra cost to you.";

export const SPONSOR_PLACEMENTS: SponsorPlacement[] = [
  {
    id: "apex-hosting",
    title: "Need a practice server?",
    body: "Apex Hosting sets up a Minecraft server in minutes - handy for PvP/UHC/Bedwars practice with friends.",
    ctaLabel: "Get a server",
    url: APEX_HOSTING_AFFILIATE_URL,
    disclosure: APEX_HOSTING_DISCLOSURE,
  },
];
