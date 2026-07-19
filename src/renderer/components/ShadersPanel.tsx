// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef, useState } from "react";
import type { Instance, ShaderPackInfo } from "@shared/types";
import { DownloadIcon, PlusIcon, XIcon } from "./Icons";
import { toast } from "../toast";

interface Props {
  instance: Instance;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Manages the instance's `shaderpacks/` folder (import/remove .zip files) - it doesn't pick which
 * pack is *active*, since that's an in-game Iris/Oculus Video Settings choice, not something the
 * launcher's config-file model can drive. Shaderpacks need a shader loader (Iris on Fabric, Oculus
 * on Forge), which are third-party mods Omega doesn't bundle or auto-install - so this panel offers
 * a clearly-attributed, opt-in "Install shader loader" action rather than pulling them in silently.
 */
export default function ShadersPanel({ instance }: Props) {
  const modsDir = instance.modsDir;
  const loaderSupported = instance.loader === "fabric" || instance.loader === "quilt" || instance.loader === "forge";

  const [packs, setPacks] = useState<ShaderPackInfo[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [hasLoader, setHasLoader] = useState<boolean | null>(null);
  const [installingLoader, setInstallingLoader] = useState(false);
  // Guards against two overlapping shaders:import/remove round-trips landing out of order (e.g.
  // remove pack A then quickly remove pack B) - only the response to the most recently issued
  // request is allowed to win. Same pattern as InstanceDetail's modsRequestRef, for the same reason.
  const requestRef = useRef(0);

  const load = () => window.api.shaders.list(modsDir).then(setPacks);
  const refreshLoader = () => {
    if (!loaderSupported) return;
    window.api.shaders.hasLoader(instance).then(setHasLoader);
  };

  useEffect(() => {
    load();
    refreshLoader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modsDir]);

  const handleImport = async () => {
    const paths = await window.api.dialog.pickShaderFiles();
    if (paths.length === 0) return;
    setImporting(true);
    const requestId = ++requestRef.current;
    try {
      const updated = await window.api.shaders.import(modsDir, paths);
      if (requestId === requestRef.current) setPacks(updated);
      toast(`Imported ${paths.length} shader pack${paths.length === 1 ? "" : "s"} - pick one in-game under Video Settings > Shader Packs.`, "success");
    } catch (err) {
      toast(`Couldn't import shader packs: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (fileName: string) => {
    const requestId = ++requestRef.current;
    const updated = await window.api.shaders.remove(modsDir, fileName);
    if (requestId === requestRef.current) setPacks(updated);
  };

  const installLoader = async () => {
    setInstallingLoader(true);
    try {
      const { installed } = await window.api.shaders.installLoader(instance);
      toast(
        installed.length > 0
          ? `Shader loader installed (${installed.join(", ")})`
          : "Shader loader was already installed",
        "success"
      );
      setHasLoader(true);
    } catch (err) {
      toast(`Couldn't install a shader loader: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setInstallingLoader(false);
    }
  };

  if (!packs) return <p className="empty-hint">Loading shader packs&hellip;</p>;

  const loaderName = instance.loader === "forge" ? "Oculus" : "Iris + Sodium";

  return (
    <div className="settings-panel shaders-panel">
      <p className="instance-subtitle">
        Import <code>.zip</code> shader packs here, then pick the active one in-game under Video Settings &rarr; Shader
        Packs - the launcher can't select it for you, that menu lives inside the game.
      </p>

      {!loaderSupported && (
        <p className="empty-hint">
          Shaders need a Fabric or Forge instance - this instance's loader ({instance.loader}) has no shader loader
          available.
        </p>
      )}

      {loaderSupported && hasLoader === false && (
        <div className="shader-loader-card">
          <div>
            <p className="shader-loader-title">A shader loader is required</p>
            <p className="shader-loader-body">
              Shaderpacks won't load without {loaderName}. These are third-party mods (Iris &amp; Sodium are LGPL-3.0,
              Oculus LGPL-3.0) that Omega doesn't own or bundle - clicking below downloads them from Modrinth into this
              instance. Omega isn't affiliated with their authors.
            </p>
          </div>
          <button className="btn btn-primary shader-loader-btn" disabled={installingLoader} onClick={installLoader}>
            <DownloadIcon size={14} /> {installingLoader ? "Installing..." : `Install ${loaderName}`}
          </button>
        </div>
      )}

      <div className="mods-toolbar">
        <button className="btn btn-secondary" disabled={importing} onClick={handleImport}>
          <PlusIcon size={14} /> {importing ? "Importing..." : "Import shader packs"}
        </button>
      </div>

      <div className="mod-list">
        {packs.length === 0 && (
          <p className="empty-hint">
            No shader packs yet. Download one as a <code>.zip</code> (e.g. from Modrinth) and import it here.
          </p>
        )}
        {packs.map((pack) => (
          <div key={pack.fileName} className="mod-row">
            <div className="mod-info">
              <div className="mod-title-row">
                <span className="mod-name">{pack.fileName}</span>
                <span className="mod-version">{formatSize(pack.sizeBytes)}</span>
              </div>
            </div>
            <div className="mod-row-actions">
              <button className="btn btn-ghost btn-danger" title="Remove shader pack" onClick={() => handleRemove(pack.fileName)}>
                <XIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
