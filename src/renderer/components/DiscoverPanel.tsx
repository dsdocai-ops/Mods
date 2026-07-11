// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveredMod, Instance, ModInfo } from "@shared/types";
import { toast } from "../toast";

interface Props {
  instance: Instance;
  /** Currently-installed mods, used to flip rows to "Installed" instead of offering a duplicate download. */
  installedMods: ModInfo[];
  /** Install returns the instance's full refreshed mod list - hand it back up so the Installed view stays in sync. */
  onModsChanged: (mods: ModInfo[]) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

/**
 * The Mods tab's Discover view: browse and install mods compatible with this instance straight
 * from the launcher. Loads a default feed (most-downloaded compatible mods) the moment it opens -
 * discovery must work before the user has any mod name to look up - and the search box narrows
 * from there. Everything shown is pre-filtered to the instance's Minecraft version + loader by
 * the main process (see main/modDiscovery.ts).
 */
export default function DiscoverPanel({ instance, installedMods, onModsChanged }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveredMod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  // Out-of-order guard for overlapping searches (type fast, responses land last-write-wins
  // otherwise) - same pattern as InstanceDetail's modsRequestRef.
  const requestRef = useRef(0);

  const moddable = instance.loader === "fabric" || instance.loader === "quilt" || instance.loader === "forge";

  useEffect(() => {
    if (!moddable) return;
    const requestId = ++requestRef.current;
    // The initial (empty-query) feed fires immediately; only typed queries get debounced.
    const timer = setTimeout(
      () => {
        window.api.mods
          .discover(instance, query)
          .then((hits) => {
            if (requestId !== requestRef.current) return;
            setResults(hits);
            setError(null);
          })
          .catch((err) => {
            if (requestId !== requestRef.current) return;
            setResults([]);
            setError(err instanceof Error ? err.message : String(err));
          });
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, query, moddable]);

  const isInstalled = useCallback(
    (mod: DiscoveredMod) => {
      const slug = mod.slug.toLowerCase();
      return installedMods.some(
        // Manifest mod ids usually match the Modrinth slug modulo underscores ("fabric_api" vs
        // "fabric-api"); jar filenames conventionally start with the slug. Either signal counts.
        (m) => m.modId.toLowerCase().replace(/_/g, "-") === slug || m.fileName.toLowerCase().startsWith(slug)
      );
    },
    [installedMods]
  );

  const handleInstall = async (mod: DiscoveredMod) => {
    setInstalling((prev) => new Set(prev).add(mod.projectId));
    try {
      const updated = await window.api.mods.installDiscovered(instance, mod.projectId);
      onModsChanged(updated);
      toast(`${mod.title} installed (with any required dependencies)`, "success");
    } catch (err) {
      toast(`Couldn't install ${mod.title}: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(mod.projectId);
        return next;
      });
    }
  };

  if (!moddable) {
    return (
      <p className="empty-hint">
        This instance runs {instance.loader}, which can't load Fabric/Forge mods - create a Fabric or Forge instance
        to discover and install mods here.
      </p>
    );
  }

  return (
    <>
      <div className="mods-toolbar">
        <input
          className="input"
          placeholder="Search Modrinth (leave empty to browse the most popular mods)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <p className="instance-subtitle discover-hint">
        Everything below is compatible with this instance ({instance.loader}). Installs land in the instance's mods
        folder, required dependencies included.
      </p>

      <div className="mod-list">
        {error && <p className="error-text">Couldn't reach Modrinth: {error}</p>}
        {results === null && !error && <p className="empty-hint">Loading popular mods&hellip;</p>}
        {results !== null && results.length === 0 && !error && (
          <p className="empty-hint">No compatible mods found{query.trim() ? ` for "${query.trim()}"` : ""}.</p>
        )}
        {(results ?? []).map((mod) => {
          const installed = isInstalled(mod);
          const busy = installing.has(mod.projectId);
          return (
            <div key={mod.projectId} className="mod-row">
              {mod.iconUrl ? (
                <img className="discover-icon" src={mod.iconUrl} alt="" loading="lazy" />
              ) : (
                <div className="discover-icon discover-icon-placeholder">◆</div>
              )}
              <div className="mod-info">
                <div className="mod-title-row">
                  <span className="mod-name">{mod.title}</span>
                  {mod.author && <span className="mod-version">by {mod.author}</span>}
                  <span className="mod-loader">{formatDownloads(mod.downloads)} downloads</span>
                </div>
                {mod.description && <p className="mod-description">{mod.description}</p>}
                {mod.categories.length > 0 && (
                  <div className="mod-tags">
                    {mod.categories.slice(0, 5).map((category) => (
                      <span key={category} className="tag">
                        {category}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mod-row-actions">
                {installed ? (
                  <span className="discover-installed">Installed ✓</span>
                ) : (
                  <button className="btn btn-secondary" disabled={busy} onClick={() => handleInstall(mod)}>
                    {busy ? "Installing..." : "Install"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
