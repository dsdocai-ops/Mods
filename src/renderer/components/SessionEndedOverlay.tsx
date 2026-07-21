// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// "Afterglow": the quiet counterpart to the Ignition launch overlay. Purely visual and fully
// non-blocking - the whole overlay is pointer-events:none, so it handles no clicks, keys, or focus.
// All timing lives in App.tsx (one timeout drives mount/unmount); this component just renders the beat.

import { composeBannerFilter } from "@shared/banners";

interface Props {
  name: string;
  // Session length in ms, or null when no start time is known (e.g. launcher restarted mid-session) -
  // in which case the duration line is omitted entirely.
  durationMs: number | null;
  // Resolved banner theme's CSS filter for the blurred backdrop layer - dimmer and desaturated here
  // than Ignition to match the settled mood.
  bannerFilter: string;
}

// "Played for 1h 23m" / "Played for 12m 30s" / "Played for 47s": largest two units at most, with any
// zero leading units dropped (a sub-hour session never shows "0h", a sub-minute one never shows "0m").
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (h > 0 || m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return `Played for ${parts.slice(0, 2).join(" ")}`;
}

export default function SessionEndedOverlay({ name, durationMs, bannerFilter }: Props) {
  return (
    <div className="session-ended" aria-hidden="true">
      <div
        className="session-ended-art"
        aria-hidden="true"
        style={{ filter: composeBannerFilter(bannerFilter, "blur(24px) saturate(0.6)") }}
      />
      <div className="session-ended-content">
        <div className="session-ended-stage">
          <span className="session-ended-ring" />
          <div className="session-ended-omega">&#937;</div>
        </div>
        <div className="session-ended-name">{name}</div>
        <div className="session-ended-kicker">SESSION ENDED</div>
        {durationMs !== null && <div className="session-ended-duration">{formatDuration(durationMs)}</div>}
      </div>
    </div>
  );
}
