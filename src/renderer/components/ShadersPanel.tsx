// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef, useState } from "react";
import type { ShaderPackInfo } from "@shared/types";
import { toast } from "../toast";

interface Props {
  modsDir: string;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Manages the instance's `shaderpacks/` folder (import/remove .zip files) - it doesn't pick which
 * pack is *active*, since that's an in-game Iris/Oculus Video Settings choice, not something the
 * launcher's config-file model can drive. A compatible shader loader (Iris+Sodium on Fabric, Oculus
 * on Forge) is preinstalled automatically alongside the Omega mod - see bundledMods.ts - so an empty
 * list here genuinely means "no packs imported yet," not "shaders unsupported."
 */
export default function ShadersPanel({ modsDir }: Props) {
  const [packs, setPacks] = useState<ShaderPackInfo[] | null>(null);
  const [importing, setImporting] = useState(false);
  // Guards against two overlapping shaders:import/remove round-trips landing out of order (e.g.
  // remove pack A then quickly remove pack B) - only the response to the most recently issued
  // request is allowed to win. Same pattern as InstanceDetail's modsRequestRef, for the same reason.
  const requestRef = useRef(0);

  const load = () => window.api.shaders.list(modsDir).then(setPacks);

  useEffect(() => {
    load();
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

  if (!packs) return <p className="empty-hint">Loading shader packs&hellip;</p>;

  return (
    <div className="settings-panel shaders-panel">
      <p className="instance-subtitle">
        A shader loader (Iris + Sodium on Fabric, Oculus on Forge) is preinstalled automatically. Import
        <code>.zip</code> shader packs here, then pick the active one in-game under Video Settings &rarr; Shader
        Packs - the launcher can't select it for you, that menu lives inside the game.
      </p>

      <div className="mods-toolbar">
        <button className="btn btn-secondary" disabled={importing} onClick={handleImport}>
          {importing ? "Importing..." : "+ Import shader packs"}
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
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
