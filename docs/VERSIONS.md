<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->
# Omega Mod Versions System

## Overview

The launcher can download and install Minecraft from Mojang's version manifest with vanilla, Fabric, or Forge. The Omega companion mod is now **version-aware**: support for each Minecraft version is no longer hardcoded in the app, but declared in a manifest file (`omega-versions.json` at repo root).

Versions fall into three tiers: **main** — the single flagship version (1.20.1 today) with full Omega features; **bridge** — thin ports via the OmegaHooks/mixin-overlay architecture (see `mod/PORTING.md`), carrying core features; and **unlisted** — any other release, vanilla-playable and downloadable from the launcher, but Omega is skipped. Tier model lets us focus engineering on the flagship while making the mod available across a history of releases.

## The Manifest

Source of truth: `omega-versions.json` at repo root. Schema:
```json
{
  "schemaVersion": 1,
  "versions": [
    { "minecraft": "1.20.1", "tier": "main", "loaders": ["fabric", "forge"], "modVersion": "0.1.0" }
  ]
}
```

**Fields:**
- `schemaVersion` — version of this manifest format; bumped only for backward-incompatible changes.
- `minecraft` — exact Minecraft version ID (must exist in Mojang's manifest).
- `tier` — `"main"` (flagship) or `"bridge"` (thin port). Tiers inform launcher UI (install picker annotations), Omega jar selection, and feature expectations.
- `loaders` — array of loaders this tier supports: `["fabric"]`, `["forge"]`, or `["fabric", "forge"]`.
- `modVersion` — the Omega mod version that runs on this Minecraft version; used to detect updates.

**Fallback chain** (if manifest is offline/malformed/missing): last cached copy in userData → bundled copy → built-in default (1.20.1 main).

## Runtime Resolution

The launcher's `src/main/versionsCatalog.ts` follows this chain on every launch:
1. Fetch from rolling GitHub Release: `https://github.com/dsdocai-ops/Mods/releases/download/latest-build/omega-versions.json`
2. Fall back to last cached copy (if cached on this machine during a prior successful fetch)
3. Fall back to copy bundled inside the packaged app
4. Fall back to built-in default (1.20.1 main, tier main, loaders fabric+forge, modVersion 0.1.0)

A malformed remote manifest is rejected by schema validation and never breaks launches — cached/bundled/default always remain available.

## How the Launcher Uses It

**Install picker**: when creating a new instance, the picker shows annotations next to each version (main-tier only gets "Full Omega", bridge tiers get "Partial Omega / Core features only", unlisted versions get no Omega tag).

**Mod installation**: before launching, `src/main/launch.ts` calls `ensureOmegaMods()` (in `src/main/versionsCatalog.ts`), which:
- Resolves the instance's Minecraft version against the manifest
- If found: fetches/selects the version-tagged Omega jar (e.g., `omega-client-fabric-1.20.1.jar`) and installs it to the mods folder
- If not found: skips Omega (instance remains vanilla-playable)

## Shipping a New Version

To add support for a new Minecraft version:
1. **Port the mod** per `mod/PORTING.md` (create version-specific mixin overlays, verify injection targets against new mappings).
2. **CI builds version-tagged jars** in the same run (e.g., `omega-client-fabric-1.21.11.jar`, `omega-client-forge-1.21.11.jar`).
3. **Add manifest entry**: append a new version object to `omega-versions.json` with the appropriate `tier`, `loaders`, and `modVersion`.
4. **Merge to main** and push.
5. **CI publishes both** (manifest + jars) to the rolling `latest-build` release in the same workflow run — they stay in lockstep.
6. **Rollout is automatic**: every installed launcher fetches the updated manifest on its next startup and picks up the new version with zero app update needed.

Critical rule: **Never publish a manifest entry before its jar exists.** CI enforces this by publishing manifest and jars in one atomic operation.

## Failure Modes

**Offline**: no network to fetch remote manifest. Resolution chain immediately falls back to cached/bundled/default, launch proceeds normally.

**Malformed remote manifest**: JSON parse error or schema mismatch. Rejected silently; fallback chain takes over. Launcher remains functional.

**Manifest ahead of jars**: manifest lists a version but corresponding jars haven't been published yet. `ensureOmegaMods()` fails to find the jar and skips Omega (instance runs vanilla). Safe because we never publish manifest before jars — this should not happen in production.

All failure modes are safe: the cached/bundled/default fallback ensures the launcher never breaks, and a missing Omega jar degrades gracefully to vanilla-playable.
