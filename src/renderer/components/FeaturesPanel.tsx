// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import { toast } from "../toast";

interface Props {
  modsDir: string;
}

type ConfigData = Record<string, unknown>;

/**
 * Lunar-style first-class feature toggles: edits the preinstalled Omega mod's config file
 * (config/omega-client.json) directly, so everything here is also live in the in-game menu
 * (Right Shift) and vice versa. The mod reads this file at game startup - if the game is already
 * running, changes apply on the next launch (in-game, use Right Shift instead).
 */
export default function FeaturesPanel({ modsDir }: Props) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [data, setData] = useState<ConfigData | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const path = await window.api.modConfig.ensureOmega(modsDir);
        const file = await window.api.modConfig.read(path);
        if (!cancelled) {
          setFilePath(file.path);
          setData(file.data);
        }
      } catch (err) {
        if (!cancelled) toast(`Couldn't load features config: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modsDir]);

  const set = (key: string, value: unknown) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!filePath || !data) return;
    setSaving(true);
    try {
      await window.api.modConfig.write(filePath, "json", data);
      setDirty(false);
      toast("Features saved - applies on next launch (or instantly via Right Shift in-game)", "success");
    } catch (err) {
      toast(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="empty-hint">Loading features&hellip;</p>;

  const boolRow = (key: string, label: string, hint?: string) => (
    <label className="field-checkbox feature-row" key={key}>
      <input type="checkbox" checked={Boolean(data[key])} onChange={(e) => set(key, e.target.checked)} />
      <span>
        {label}
        {hint && <em className="feature-hint"> — {hint}</em>}
      </span>
    </label>
  );

  const density = typeof data.particleDensity === "number" ? (data.particleDensity as number) : 1;

  return (
    <div className="settings-panel features-panel">
      <p className="instance-subtitle">
        Built-in Omega features, preinstalled with every Fabric/Forge instance. Same settings as the in-game menu
        (Right Shift) — the game reads them at startup.
      </p>

      <h3 className="settings-subheading">Visual & PvP</h3>
      {boolRow("fullbrightEnabled", "Fullbright", "max brightness, no torch spam")}
      {boolRow("blockHighlightEnabled", "Block Highlight", "outline obsidian/anchors for combat clarity")}
      {boolRow("customFovEnabled", "Custom FOV")}
      <div className="field-row feature-numbers">
        <label className="field">
          <span>FOV</span>
          <input
            className="input"
            type="number"
            min={30}
            max={110}
            value={Number(data.customFov ?? 90)}
            onChange={(e) => set("customFov", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Zoom FOV (hold C)</span>
          <input
            className="input"
            type="number"
            min={1}
            max={70}
            value={Number(data.zoomFov ?? 30)}
            onChange={(e) => set("zoomFov", Number(e.target.value))}
          />
        </label>
      </div>
      {boolRow("toggleSprintEnabled", "Toggle Sprint", "sprint without holding the key")}
      {boolRow("noHurtCamEnabled", "No Hurt Camera", "no screen shake when taking damage")}
      {boolRow("noFogEnabled", "No Fog", "removes terrain, water and nether fog")}
      {boolRow("clearWeatherEnabled", "Clear Weather", "visual only - never see or hear rain")}
      {boolRow("showOmegaUsersEnabled", "Show Omega Users", "\u03a9 badge on nametags of other Omega players (needs server relay support)")}

      <h3 className="settings-subheading">HUD</h3>
      {boolRow("hudEnabled", "Info HUD")}
      {boolRow("hudShowCoords", "Show coordinates")}
      {boolRow("hudShowFps", "Show FPS")}
      {boolRow("hudShowPing", "Show ping", "hidden in singleplayer")}
      {boolRow("hudShowDirection", "Show facing direction")}
      {boolRow("hudShowCps", "Show CPS", "left | right clicks per second")}
      {boolRow("hudShowKeystrokes", "Show keystrokes")}

      <h3 className="settings-subheading">Particles</h3>
      {boolRow("particlesMasterEnabled", "All particles", "master switch - off means none at all")}
      {boolRow("blockParticlesEnabled", "Block particles")}
      {boolRow("ambientParticlesEnabled", "Ambient block particles", "smoke, drips, spores")}
      {boolRow("totemParticlesEnabled", "Totem particles")}
      {boolRow("critParticlesEnabled", "Crit particles")}
      {boolRow("explosionParticlesEnabled", "Explosion particles")}
      {boolRow("portalParticlesEnabled", "Portal particles")}
      <label className="field">
        <span>Particle density</span>
        <select className="input" value={String(density)} onChange={(e) => set("particleDensity", Number(e.target.value))}>
          <option value="1">100%</option>
          <option value="0.75">75%</option>
          <option value="0.5">50%</option>
          <option value="0.25">25%</option>
          <option value="0.1">10%</option>
        </select>
      </label>

      <h3 className="settings-subheading">Building</h3>
      {boolRow("schematicPreviewEnabled", "Schematic ghost preview", "manage schematics in-game via Right Shift")}

      <div className="settings-actions">
        <button className="btn btn-primary" disabled={saving || !dirty} onClick={save}>
          {saving ? "Saving..." : dirty ? "Save Features" : "Saved"}
        </button>
      </div>
    </div>
  );
}
