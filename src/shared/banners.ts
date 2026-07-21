// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/**
 * Per-instance banner art themes. Every theme is a CSS grading of the one bundled hero.jpg (no extra
 * image assets - keeps the app light and sidesteps asset sourcing), so a theme is just an id, a
 * display name, and a CSS `filter` string applied over the shared hero image. Defined ONCE here as a
 * dependency-free plain data module so both the renderer (cards, thumb, picker, detail header,
 * launch overlays) and the main-process typing can import it safely.
 */
export interface BannerTheme {
  id: string;
  /** Shown under the picker swatch and nowhere the user can't see it. */
  name: string;
  /** CSS `filter` value applied over hero.jpg. "none" is the ungraded original (meadow). */
  filter: string;
}

export const BANNER_THEMES: BannerTheme[] = [
  { id: "meadow", name: "Meadow", filter: "none" },
  { id: "frost", name: "Frost", filter: "hue-rotate(150deg) saturate(1.1)" },
  { id: "dusk", name: "Dusk", filter: "hue-rotate(-70deg) saturate(1.15)" },
  { id: "aurum", name: "Aurum", filter: "sepia(0.4) saturate(1.4)" },
  // Sepia-first, then a small negative rotation: pushing every hue to amber and rotating toward red
  // is the only way this green/blue-heavy source reads as fire - a plain hue-rotate lands on magenta.
  { id: "ember", name: "Ember", filter: "sepia(0.65) hue-rotate(-28deg) saturate(2.1) brightness(0.86)" },
  { id: "verdant", name: "Verdant", filter: "hue-rotate(55deg) saturate(1.35)" },
  { id: "abyss", name: "Abyss", filter: "grayscale(0.35) brightness(0.6) hue-rotate(190deg)" },
  { id: "mono", name: "Mono", filter: "grayscale(1) contrast(1.08)" },
];

/**
 * The four themes the `auto` pseudo-value resolves to, in hash order (0..3). This preserves the
 * launcher's original behavior exactly: before per-instance banners, an id hash picked one of four
 * hero.jpg hue variants (meadow/frost/dusk/aurum), so an instance with no `banner` field still lands
 * on its historical look.
 */
const AUTO_THEME_IDS = ["meadow", "frost", "dusk", "aurum"] as const;

/** Sentinel picker value for "let the id hash choose" - not a real theme id, absent from Instance.banner. */
export const AUTO_BANNER = "auto";

/**
 * Stable 0..3 hash of an instance id (sum of char codes mod 4) - the original per-instance banner
 * variant selector, kept so `auto` resolves to the exact art an instance showed before this feature.
 */
export function bannerHash(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % 4;
}

/** Look up a theme by id, or undefined if the id isn't a known theme (e.g. "auto" or stale data). */
export function bannerThemeById(id: string): BannerTheme | undefined {
  return BANNER_THEMES.find((t) => t.id === id);
}

/**
 * Resolve an instance's stored banner field to a concrete theme. `banner` absent (or "auto", or an
 * unknown id) falls back to the id-hash pick, so existing instances look unchanged until a user picks.
 */
export function resolveBannerTheme(id: string, banner?: string): BannerTheme {
  if (banner && banner !== AUTO_BANNER) {
    const picked = bannerThemeById(banner);
    if (picked) return picked;
  }
  return bannerThemeById(AUTO_THEME_IDS[bannerHash(id)]) ?? BANNER_THEMES[0];
}

/**
 * Compose a theme's grading with extra effects for the launch overlays' blurred backdrop layer.
 * Drops meadow's "none" (which is only valid as a sole filter value) before appending, so the result
 * is always a valid CSS `filter` string.
 */
export function composeBannerFilter(themeFilter: string, extra: string): string {
  const base = themeFilter === "none" ? "" : themeFilter;
  return `${base} ${extra}`.trim();
}
