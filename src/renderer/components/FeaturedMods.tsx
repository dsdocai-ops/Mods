// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { FeaturedMod } from "@shared/types";
import { toast } from "../toast";

interface Props {
  /** Lowercased file ids and mod ids already present in the instance's modsDir - lets a result show "Installed" instead of a download link. */
  installedIds: Set<string>;
}

/**
 * The "Featured" Discover segment: Omega's own curated custom mods, as opposed to the CurseForge
 * segment's live API search. Backed by a static list (main/featuredMods.ts), not a search box - a
 * "coming-soon" entry (announced but not built yet, like Health Indicator) shows a disabled
 * placeholder instead of a download button.
 */
export default function FeaturedMods({ installedIds }: Props) {
  const [mods, setMods] = useState<FeaturedMod[] | null>(null);

  useEffect(() => {
    window.api.featured
      .list()
      .then(setMods)
      .catch((err: unknown) => {
        setMods([]);
        toast(`Couldn't load featured mods: ${err instanceof Error ? err.message : String(err)}`, "error");
      });
  }, []);

  if (mods === null) return <p className="empty-hint">Loading featured mods&hellip;</p>;
  if (mods.length === 0) return <p className="empty-hint">No featured mods yet - check back soon.</p>;

  return (
    <div className="discover-list">
      {mods.map((mod) => {
        const alreadyHave = installedIds.has(mod.id.toLowerCase());
        return (
          <div key={mod.id} className="discover-card">
            {mod.iconUrl ? (
              <img className="discover-icon" src={mod.iconUrl} alt="" loading="lazy" />
            ) : (
              <div className="discover-icon discover-icon-fallback" aria-hidden />
            )}
            <div className="discover-body">
              <div className="discover-titlerow">
                <span className="discover-title">{mod.name}</span>
                {mod.author && <span className="discover-author">by {mod.author}</span>}
                {mod.status === "coming-soon" && <span className="discover-badge">Coming Soon</span>}
              </div>
              <p className="discover-desc">{mod.description}</p>
            </div>
            <button
              className="btn btn-secondary discover-install"
              disabled={mod.status === "coming-soon" || alreadyHave}
              onClick={() => mod.downloadUrl && window.api.external.open(mod.downloadUrl)}
            >
              {mod.status === "coming-soon" ? "Coming Soon" : alreadyHave ? "Installed" : "Download"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
