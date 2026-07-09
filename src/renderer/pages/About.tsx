// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { DiscordIcon, ExternalLinkIcon, GitHubIcon, GlobeIcon } from "../components/Icons";
import { DISCORD_URL, GITHUB_URL, WEBSITE_URL } from "@shared/links";

/**
 * The About screen, reached from the sidebar's About item: what Omega Client is, plus links out to
 * the project (GitHub, Discord, website).
 */
export default function About() {
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
    </div>
  );
}
