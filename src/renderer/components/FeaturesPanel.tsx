// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import { toast } from "../toast";

interface Props {
  modsDir: string;
}

type ConfigData = Record<string, unknown>;

/**
 * Read-only view of the preinstalled Omega mod's config file (config/omega-client.json) - lets you
 * check current state without leaving the launcher, but every toggle/value is edited in-game only
 * now (Right Shift, or the Omega button in the vanilla pause menu - see mod/README.md's menu list
 * for exactly where each one lives: main menu, HUD..., Visual Settings..., or Particles...). Two
 * front doors to the same file both trying to be authoritative was a real bug surface (the
 * launcher's "Save" and an in-game change could silently clobber each other if both were open at
 * once) - one editor removes that entirely, and in-game is the one that has to exist anyway.
 */
export default function FeaturesPanel({ modsDir }: Props) {
  const [data, setData] = useState<ConfigData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const path = await window.api.modConfig.ensureOmega(modsDir);
        const file = await window.api.modConfig.read(path);
        if (!cancelled) setData(file.data);
      } catch (err) {
        if (!cancelled) toast(`Couldn't load features config: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modsDir]);

  if (!data) return <p className="empty-hint">Loading features&hellip;</p>;

  const boolRow = (key: string, label: string, hint?: string) => (
    <label className="field-checkbox feature-row feature-row-readonly" key={key}>
      <input type="checkbox" checked={Boolean(data[key])} disabled readOnly />
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
        Built-in Omega features, preinstalled with every Fabric/Forge instance. Read-only here - everything below is
        set in-game (Right Shift, or the Omega button in the pause menu) so there's one place that's actually in
        charge of this file, not two.
      </p>

      <h3 className="settings-subheading">Visual & PvP</h3>
      {boolRow("fullbrightEnabled", "Fullbright", "max brightness, no torch spam")}
      {boolRow("blockHighlightEnabled", "Block Highlight", "outline obsidian/anchors for combat clarity - color/block list in-game via Visual Settings...")}
      {boolRow("customFovEnabled", "Custom FOV", `FOV ${Number(data.customFov ?? 90)} / Zoom ${Number(data.zoomFov ?? 30)} - set in-game via Visual Settings...`)}
      {boolRow("toggleSprintEnabled", "Toggle Sprint", "sprint without holding the key")}
      {boolRow("noHurtCamEnabled", "No Hurt Camera", "no screen shake when taking damage")}
      {boolRow("noFogEnabled", "No Fog", "removes terrain, water and nether fog")}
      {boolRow("clearWeatherEnabled", "Clear Weather", "visual only - never see or hear rain")}
      {boolRow("showOmegaUsersEnabled", "Show Omega Users", "Omega badge on nametags of other Omega players (needs server relay support)")}

      <h3 className="settings-subheading">HUD</h3>
      {boolRow("hudEnabled", "Info HUD", "individual rows below also live in-game via HUD...")}
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
      <p className="feature-row feature-row-readonly">
        Particle density: {Math.round(density * 100)}%<em className="feature-hint"> — set in-game via Particles...</em>
      </p>

      <h3 className="settings-subheading">Building</h3>
      {boolRow("schematicPreviewEnabled", "Schematic ghost preview", "manage schematics in-game via Right Shift then Schematics...")}
    </div>
  );
}
