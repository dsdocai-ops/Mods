// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef, useState } from "react";
import type { CurseForgeInstallProgress, CurseForgeSearchHit, Instance } from "@shared/types";
import { DownloadIcon, SearchIcon } from "./Icons";
import { toast } from "../toast";

interface Props {
  instance: Instance;
  /** Lowercased file ids and mod ids already present in the instance's modsDir - lets a result show "Installed" instead of an install button. */
  installedIds: Set<string>;
  /** Called after a successful install so the parent can reload the installed-mods list. */
  onInstalled: () => void;
}

/**
 * The "CurseForge" Discover segment: searches CurseForge for mods compatible with this instance's
 * loader + Minecraft version and installs the chosen one (plus its required dependencies) into
 * modsDir. Uses Omega's own shared CurseForge API key (main/curseforge.ts) - there's nothing for
 * the player to configure here, same as the Modrinth segment.
 */
export default function CurseForgeMods({ instance, installedIds, onInstalled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CurseForgeSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<number | null>(null);
  const [progress, setProgress] = useState<CurseForgeInstallProgress | null>(null);

  const searchRequestRef = useRef(0);

  useEffect(() => window.api.curseforge.onProgress(setProgress), []);

  const runSearch = async () => {
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    try {
      const hits = await window.api.curseforge.search(query, instance.loader, instance.versionId);
      if (requestId === searchRequestRef.current) setResults(hits);
    } catch (err) {
      if (requestId === searchRequestRef.current) {
        setResults([]);
        toast(`Couldn't reach CurseForge: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  };

  const install = async (hit: CurseForgeSearchHit) => {
    if (installingId) return;
    setInstallingId(hit.modId);
    setProgress(null);
    try {
      const result = await window.api.curseforge.install(instance.modsDir, hit.modId, instance.loader, instance.versionId);
      const depNote = result.installedFiles.length > 1 ? ` (+${result.installedFiles.length - 1} dependenc${result.installedFiles.length - 1 === 1 ? "y" : "ies"})` : "";
      toast(`Installed ${hit.name}${depNote}`, "success");
      if (result.skippedDependencies.length > 0) {
        toast(`${hit.name} has ${result.skippedDependencies.length} required dependenc${result.skippedDependencies.length === 1 ? "y" : "ies"} with no matching build - it may not load.`, "info");
      }
      onInstalled();
    } catch (err) {
      toast(`Couldn't install ${hit.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setInstallingId(null);
      setProgress(null);
    }
  };

  if (instance.loader === "vanilla") {
    return (
      <p className="empty-hint">
        This is a vanilla instance, so there's no mod loader to install mods into. Create a Fabric or Forge instance to
        browse and download mods here.
      </p>
    );
  }

  return (
    <div className="discover">
      <div className="mods-toolbar">
        <div className="search-wrap">
          <SearchIcon size={15} />
          <input
            className="input search-input"
            placeholder={`Search CurseForge for ${instance.loader} mods (${instance.versionId})`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
          />
        </div>
        <button className="btn btn-secondary" disabled={searching} onClick={runSearch}>
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {results === null && (
        <p className="empty-hint">
          Search CurseForge's mod catalog and install any result straight into this instance - required dependencies
          come along automatically.
        </p>
      )}
      {results !== null && results.length === 0 && !searching && (
        <p className="empty-hint">No compatible mods found. Try a different search, or check the version/loader.</p>
      )}

      <div className="discover-list">
        {(results ?? []).map((hit) => {
          const isInstalling = installingId === hit.modId;
          const alreadyHave = installedIds.has(hit.slug.toLowerCase());
          return (
            <div key={hit.modId} className="discover-card">
              {hit.iconUrl ? (
                <img className="discover-icon" src={hit.iconUrl} alt="" loading="lazy" />
              ) : (
                <div className="discover-icon discover-icon-fallback" aria-hidden />
              )}
              <div className="discover-body">
                <div className="discover-titlerow">
                  <span className="discover-title">{hit.name}</span>
                  {hit.author && <span className="discover-author">by {hit.author}</span>}
                  <span className="discover-downloads">{formatDownloads(hit.downloads)} downloads</span>
                </div>
                <p className="discover-desc">{hit.summary}</p>
                {isInstalling && progress && <p className="discover-progress">{progress.detail}</p>}
              </div>
              <button
                className="btn btn-secondary discover-install"
                disabled={!!installingId || alreadyHave}
                onClick={() => install(hit)}
              >
                {alreadyHave ? (
                  "Installed"
                ) : isInstalling ? (
                  "Installing..."
                ) : (
                  <>
                    <DownloadIcon size={14} /> Install
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
