// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import { composeBannerFilter } from "@shared/banners";

export type LaunchPhase = "igniting" | "success" | "closing";

interface Props {
  name: string;
  phase: LaunchPhase;
  // Most recent stream === "status" line for the launching instance ("Preparing…" until one arrives).
  status: string;
  // Whether this close is the fast failure path (0.25s) vs the normal beat fade-out (0.45s).
  fast: boolean;
  // Resolved banner theme's CSS filter, graded over the blurred hero.jpg backdrop layer.
  bannerFilter: string;
  onDismiss: () => void;
}

// The escape hatch only arms after the animation has had a moment to read - a click/Escape landing in
// the first instant would defeat the whole "deliberate moment" the min-display gate creates.
const DISMISS_ARM_MS = 1000;

export default function LaunchOverlay({ name, phase, status, fast, bannerFilter, onDismiss }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), DISMISS_ARM_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && armed) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, onDismiss]);

  const running = phase === "success";
  const cls = `launch-overlay launch-overlay-${phase}${fast ? " launch-overlay-fast" : ""}`;

  return (
    <div className={cls}>
      {/* Launching instance's banner art, blurred and dimmed behind the scrim's content so the gold
          mark stays the focus. Purely decorative; sits under the hit target and content. */}
      <div
        className="launch-overlay-art"
        aria-hidden="true"
        style={{ filter: composeBannerFilter(bannerFilter, "blur(24px) saturate(1.2)") }}
      />
      {/* The affordance is the whole overlay being clickable - automation matches visible labels, so no
          dismiss text is added. The hit layer sits under the content (which is pointer-events:none) so
          clicks anywhere reach it. */}
      <button
        type="button"
        className="launch-overlay-hit"
        aria-label="Dismiss launch animation"
        onClick={() => armed && onDismiss()}
      />
      <div className="launch-overlay-content">
        <div className="launch-overlay-stage">
          <div className="launch-overlay-rings" aria-hidden="true">
            <span className="launch-ring" />
            <span className="launch-ring" />
          </div>
          <div className="launch-omega">&#937;</div>
        </div>
        <div className="launch-overlay-name">{name}</div>
        <div className={`launch-overlay-kicker${running ? " launch-overlay-kicker-running" : ""}`}>
          {running && <span className="launch-overlay-dot running-dot" aria-hidden="true" />}
          {running ? "RUNNING" : "LAUNCHING"}
        </div>
        {/* The last status line is progress context for the wait - once the kicker says RUNNING it
          would contradict it ("RUNNING" over "Preparing…"), so it only renders while igniting. */}
      <div className="launch-overlay-status">{running ? " " : status}</div>
      </div>
    </div>
  );
}
