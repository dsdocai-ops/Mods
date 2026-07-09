// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useState } from "react";
import { DiscordIcon, ExternalLinkIcon, GitHubIcon, GlobeIcon } from "../components/Icons";
import { DISCORD_URL, GITHUB_URL, RELEASES_URL, WEBSITE_URL } from "@shared/links";
import { toast } from "../toast";

/**
 * The About screen, reached from the sidebar's About item: what Omega Client is, plus links out to
 * the project (GitHub, Discord, website) and a shortcut to check for launcher updates.
 */
export default function About() {
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Mirrors the update-check flow that used to live in the Settings page's Updates section.
  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const result = await window.api.updates.checkNow();
      if (result === "unsupported") {
        toast("Auto-update isn't available in this build (dev run or portable exe) - re-download from the Releases page instead.", "info");
      } else if (result === "ready") {
        toast("Update downloaded - a restart banner will appear.", "success");
      } else if (result === "downloading") {
        toast("Update found - downloading in the background, a restart banner will appear when it's ready.", "info");
      } else if (result === "checked") {
        toast("You're on the latest build.", "success");
      } else {
        toast("Couldn't check for updates - check your network connection.", "error");
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="settings-panel about-page">
      <div className="about-brand">
        <span className="about-omega">Ω</span>
        <div>
          <h1 className="page-title">Omega Client</h1>
          <p className="about-slogan">The last client you will ever need.</p>
        </div>
      </div>

      <p className="about-verse">
        &ldquo;I am the Alpha and the Omega, the first and the last, the beginning and the end&rdquo; &mdash;
        Revelation 22:13
      </p>

      <p className="instance-subtitle about-copy">
        A lightweight, offline-friendly Minecraft launcher built around per-instance mod toggles and smooth PvP
        performance. Point it at a Minecraft install you already have, flip your mods on and off without touching
        files by hand, and launch.
      </p>

      <h3 className="settings-subheading">Links</h3>
      <div className="about-links">
        <button className="btn btn-secondary about-link" onClick={() => window.api.external.open(GITHUB_URL)}>
          <GitHubIcon size={16} /> GitHub <ExternalLinkIcon size={13} />
        </button>
        <button className="btn btn-secondary about-link" onClick={() => window.api.external.open(DISCORD_URL)}>
          <DiscordIcon size={16} /> Discord <ExternalLinkIcon size={13} />
        </button>
        <button className="btn btn-secondary about-link" onClick={() => window.api.external.open(WEBSITE_URL)}>
          <GlobeIcon size={16} /> Website <ExternalLinkIcon size={13} />
        </button>
      </div>

      <h3 className="settings-subheading">Updates</h3>
      <p className="instance-subtitle">
        Auto-update applies to <code>OmegaClient-Setup.exe</code> installs only - the portable exe can't replace
        itself in place, so re-download it from the{" "}
        <button className="link-inline" onClick={() => window.api.external.open(RELEASES_URL)}>
          Releases page
        </button>{" "}
        instead.
      </p>
      <div className="settings-actions">
        <button className="btn btn-secondary" disabled={checkingUpdate} onClick={checkForUpdates}>
          {checkingUpdate ? "Checking..." : "Check for updates now"}
        </button>
      </div>
    </div>
  );
}
