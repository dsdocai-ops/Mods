import type { ModInfo } from "@shared/types";

interface Props {
  mod: ModInfo;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
  onConfigure: () => void;
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

export default function ModRow({ mod, onToggle, onRemove, onConfigure }: Props) {
  return (
    <div className={`mod-row ${mod.enabled ? "" : "mod-row-disabled"}`}>
      <label className="switch">
        <input type="checkbox" checked={mod.enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="slider" />
      </label>

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
        <button className="btn btn-chip" title="Edit this mod's config" onClick={onConfigure}>
          Configure
        </button>
        <button className="btn btn-ghost btn-danger" title="Remove mod" onClick={onRemove}>
          ✕
        </button>
      </div>
    </div>
  );
}
