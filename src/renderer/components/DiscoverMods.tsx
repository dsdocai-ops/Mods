// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef, useState } from "react";
import type { Instance, ModrinthInstallProgress, ModrinthSearchHit } from "@shared/types";
import { DownloadIcon, InfoIcon, SearchIcon, XIcon } from "./Icons";
import { toast } from "../toast";

interface Props {
  instance: Instance;
  /** Base file names already present in the instance's modsDir - lets a result show "Installed" instead of an install button. */
  installedFileNames: Set<string>;
  /** Called after a successful install so the parent can reload the installed-mods list. */
  onInstalled: () => void;
}

/**
 * The "Discover" half of the Mods tab: searches Modrinth for mods compatible with this instance's
 * loader + Minecraft version and installs the chosen one (plus its required dependencies) straight
 * into modsDir. Vanilla instances have no loader, so there's nothing to browse - the parent gates
 * this on that, but we double-check and show a hint.
 */
export default function DiscoverMods({ instance, installedFileNames, onInstalled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModrinthSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ModrinthInstallProgress | null>(null);
  // null while we're still reading the persisted setting - avoids the disclaimer flashing in then
  // vanishing for someone who already turned it off.
  const [showWarning, setShowWarning] = useState<boolean | null>(null);

  // Only ever commit the newest search's results - typing "sod" then "sodium" fast can land the
  // shorter query's response last otherwise, showing results for text the user already moved past.
  const searchRequestRef = useRef(0);

  useEffect(() => window.api.modrinth.onProgress(setProgress), []);
  useEffect(() => {
    window.api.settings.get().then((s) => setShowWarning(s.showModDownloadWarning));
  }, []);

  // Persisted "Don't show again": flip the setting off so the disclaimer never returns until it's
  // re-enabled from Settings. Best-effort - a failed write just means it shows again next time.
  const dontShowAgain = async () => {
    setShowWarning(false);
    try {
      const current = await window.api.settings.get();
      await window.api.settings.set({ ...current, showModDownloadWarning: false });
    } catch {
      /* non-fatal - the setting simply stays on */
    }
  };

  const runSearch = async () => {
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    try {
      const hits = await window.api.modrinth.search(query, instance.loader, instance.versionId);
      if (requestId === searchRequestRef.current) setResults(hits);
    } catch (err) {
      if (requestId === searchRequestRef.current) {
        setResults([]);
        toast(`Couldn't reach Modrinth: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  };

  const install = async (hit: ModrinthSearchHit) => {
    if (installingId) return;
    setInstallingId(hit.projectId);
    setProgress(null);
    try {
      const result = await window.api.modrinth.install(instance.modsDir, hit.projectId, instance.loader, instance.versionId);
      const depNote = result.installedFiles.length > 1 ? ` (+${result.installedFiles.length - 1} dependenc${result.installedFiles.length - 1 === 1 ? "y" : "ies"})` : "";
      toast(`Installed ${hit.title}${depNote}`, "success");
      if (result.skippedDependencies.length > 0) {
        toast(`${hit.title} has ${result.skippedDependencies.length} required dependenc${result.skippedDependencies.length === 1 ? "y" : "ies"} with no matching build - it may not load.`, "info");
      }
      onInstalled();
    } catch (err) {
      toast(`Couldn't install ${hit.title}: ${err instanceof Error ? err.message : String(err)}`, "error");
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
      {showWarning && (
        <div className="download-warning" role="alert">
          <span className="download-warning-icon">
            <InfoIcon size={16} />
          </span>
          <div className="download-warning-body">
            <p className="download-warning-title">Mods are downloaded from the internet</p>
            <p className="download-warning-text">
              Results and files come from Modrinth's public catalog, not from Omega. Only install mods from authors you
              trust - a mod runs with the same access as the game itself.
            </p>
            <div className="download-warning-actions">
              <button className="btn btn-sm" onClick={() => setShowWarning(false)}>
                Got it
              </button>
              <button className="btn btn-sm btn-ghost" onClick={dontShowAgain}>
                Don&rsquo;t show again
              </button>
            </div>
          </div>
          <button className="download-warning-close" title="Dismiss" onClick={() => setShowWarning(false)}>
            <XIcon size={14} />
          </button>
        </div>
      )}

      <div className="mods-toolbar">
        <div className="search-wrap">
          <SearchIcon size={15} />
          <input
            className="input search-input"
            placeholder={`Search Modrinth for ${instance.loader} mods (${instance.versionId})`}
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
          Search Modrinth's open mod catalog and install any result straight into this instance - no downloading jars
          by hand. Required dependencies come along automatically.
        </p>
      )}
      {results !== null && results.length === 0 && !searching && (
        <p className="empty-hint">No compatible mods found. Try a different search, or check the version/loader.</p>
      )}

      <div className="discover-list">
        {(results ?? []).map((hit) => {
          const isInstalling = installingId === hit.projectId;
          const alreadyHave =
            installedFileNames.has(hit.slug) ||
            [...installedFileNames].some((f) => f.toLowerCase().startsWith(hit.slug.toLowerCase()));
          return (
            <div key={hit.projectId} className="discover-card">
              {hit.iconUrl ? (
                <img className="discover-icon" src={hit.iconUrl} alt="" loading="lazy" />
              ) : (
                <div className="discover-icon discover-icon-fallback" aria-hidden />
              )}
              <div className="discover-body">
                <div className="discover-titlerow">
                  <span className="discover-title">{hit.title}</span>
                  {hit.author && <span className="discover-author">by {hit.author}</span>}
                  <span className="discover-downloads">{formatDownloads(hit.downloads)} downloads</span>
                </div>
                <p className="discover-desc">{hit.description}</p>
                {isInstalling && progress && (
                  <p className="discover-progress">{progress.detail}</p>
                )}
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
