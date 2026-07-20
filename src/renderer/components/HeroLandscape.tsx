// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/**
 * An original blocky mountain landscape for the Home page hero, in the spirit of the reference
 * design's background image. Not a Minecraft screenshot or extracted texture (no network access to
 * fetch one, and it'd be a copyright/trademark problem for a third-party launcher to ship Mojang's
 * own art as decoration) - built from horizontal/vertical-only staircase steps instead of smooth
 * curves, since that literal voxel-terrace silhouette is what actually reads as "Minecraft terrain"
 * to the eye (a lesson from an earlier attempt here that used smooth jagged shapes and read as
 * generic mountains instead). Grayscale by default to match the app's monochrome theme, with the
 * app's own red accent standing in for the reference's sunset glow.
 */
export default function HeroLandscape({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0a0d" />
          <stop offset="55%" stopColor="#141318" />
          <stop offset="100%" stopColor="#1c1418" />
        </linearGradient>
        <radialGradient id="heroSun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e5484d" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e5484d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="500" fill="url(#heroSky)" />
      <circle cx="560" cy="150" r="140" fill="url(#heroSun)" />
      <circle cx="560" cy="150" r="34" fill="#e5484d" opacity="0.75" />

      {/* far range - staircase steps, lightest gray, most distant */}
      <path
        d="M0,300 L0,260 L40,260 L40,230 L90,230 L90,250 L130,250 L130,200 L170,200 L170,225 L220,225 L220,190
           L260,190 L260,215 L300,215 L300,175 L345,175 L345,205 L390,205 L390,240 L430,240 L430,210
           L470,210 L470,235 L520,235 L520,195 L560,195 L560,220 L610,220 L610,250 L650,250 L650,215
           L700,215 L700,245 L740,245 L740,225 L800,225 L800,300 Z"
        fill="#2c2a30"
        opacity="0.8"
      />

      {/* mid range - darker, taller steps, closer */}
      <path
        d="M0,340 L0,300 L50,300 L50,265 L100,265 L100,290 L150,290 L150,240 L195,240 L195,270 L240,270
           L240,220 L290,220 L290,255 L335,255 L335,200 L380,200 L380,235 L425,235 L425,280 L470,280
           L470,245 L520,245 L520,270 L570,270 L570,225 L615,225 L615,260 L660,260 L660,290 L710,290
           L710,250 L760,250 L760,285 L800,285 L800,340 Z"
        fill="#1c1a1e"
      />

      {/* near range - darkest, foreground silhouette */}
      <path
        d="M0,390 L0,350 L60,350 L60,320 L120,320 L120,345 L170,345 L170,300 L225,300 L225,335 L275,335
           L275,290 L330,290 L330,325 L385,325 L385,280 L440,280 L440,315 L490,315 L490,345 L545,345
           L545,305 L600,305 L600,335 L655,335 L655,300 L710,300 L710,330 L760,330 L760,310 L800,310 L800,390 Z"
        fill="#100f12"
      />

      {/* a few simple blocky pine trees along the near ridge */}
      {[90, 250, 500, 680].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i % 2 === 0 ? 300 : 320})`}>
          <rect x="-4" y="20" width="8" height="14" fill="#0a0a0d" />
          <rect x="-16" y="6" width="32" height="10" fill="#0a0a0d" />
          <rect x="-11" y="-6" width="22" height="10" fill="#0a0a0d" />
          <rect x="-6" y="-16" width="12" height="9" fill="#0a0a0d" />
        </g>
      ))}
    </svg>
  );
}
