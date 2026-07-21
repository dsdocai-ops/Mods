// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import type { FeaturedMod } from "../shared/types";

/**
 * Omega's own curated picks for the "Featured Mods" Discover segment, as opposed to the
 * CurseForge segment's live API search. Static and hand-maintained on purpose - there's no backend
 * or database in this app (see README), so this list ships with the launcher and is edited here
 * directly when a new mod is ready to feature.
 */
export const FEATURED_MODS: FeaturedMod[] = [
  {
    id: "health-indicator",
    name: "Health Indicator",
    description: "Shows nearby players' health above their nametag - a PvP/UHC staple. Not built yet; check back soon.",
    author: "Omega",
    iconUrl: "",
    tags: ["pvp", "uhc", "hud"],
    status: "coming-soon",
  },
];

export function listFeaturedMods(): FeaturedMod[] {
  return FEATURED_MODS;
}
