// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { memo } from "react";
import type { ModInfo } from "@shared/types";
import { GearIcon, XIcon } from "./Icons";

interface Props {
  mod: ModInfo;
  // Handlers take the mod as an argument (rather than closing over it) so InstanceDetail can pass
  // the same useCallback-stable functions to every row - that's what lets memo() below actually
  // skip re-rendering unchanged rows while the parent re-renders (log streaming, filter typing).
  onToggle: (mod: ModInfo, enabled: boolean) => void;
  onRemove: (mod: ModInfo) => void;
  onConfigure: (mod: ModInfo) => void;
}

const TAG_LABELS: Record<string, string> = {
  performance: "Performance",
  pvp: "PvP",
  utility: "Utility",
  visual: "Visual",
  library: "Library",
  hud: "HUD",
  cpvp: "Crystal PvP",
  uhc: "UHC",
  bedwars: "Bedwars",
  survival: "Survival",
  other: "Other",
};

function ModRow({ mod, onToggle, onRemove, onConfigure }: Props) {
  return (
    <div className={`mod-row ${mod.enabled ? "" : "mod-row-disabled"}`}>
      <div className="mod-info">
        <div className="mod-title-row">
          <span className="mod-name">{mod.name}</span>
          <span className="mod-version">v{mod.version}</span>
          <span className="mod-loader">{mod.loader}</span>
        </div>
        {mod.description && <p className="mod-description">{mod.description}</p>}
        <div className="mod-tags">
          {mod.tags.map((tag) => (
            <span key={tag} className={`tag tag-${tag}`}>
              {TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mod-row-actions">
        <button className="btn btn-chip" title="Edit this mod's config" onClick={() => onConfigure(mod)}>
          <GearIcon size={13} /> Configure
        </button>
        <label className="switch" title={mod.enabled ? "Disable mod" : "Enable mod"}>
          <input type="checkbox" checked={mod.enabled} onChange={(e) => onToggle(mod, e.target.checked)} />
          <span className="slider" />
        </label>
        <button className="btn btn-ghost btn-danger" title="Remove mod" onClick={() => onRemove(mod)}>
          <XIcon size={14} />
        </button>
      </div>
    </div>
  );
}

export default memo(ModRow);
