# Omega Client

*The last client you will ever need.*

A lightweight, offline-first Minecraft launcher focused on **smooth performance**, **PvP**, and **one-click mod toggling**. No backend, no online account server — it drives a Minecraft install you already have and manages mods as simple on/off switches.

## Why this exists

Most launchers either lock you into vanilla, or require full manual `mods/` folder surgery to A/B test a modpack. This launcher assumes you already have Minecraft (vanilla, Forge, Fabric, Quilt, or NeoForge) installed somewhere with the standard `versions/` / `libraries/` / `assets/` layout — the official launcher, MultiMC, Prism, or a manual install all work — and layers instance management + mod toggles + PvP-tuned JVM flags on top of it, without downloading or re-hosting anything itself.

## Features

- **Instances**: point at any existing Minecraft install folder, auto-detects installed versions and their loader (vanilla/Forge/Fabric/Quilt/NeoForge) by reading the version JSON.
- **Mod toggles**: import your own mod `.jar`s and flip them on/off per-instance with a switch. Disabling renames `mod.jar` → `mod.jar.disabled`, which every loader already ignores — no destructive moves, nothing leaves the folder.
- **Automatic mod metadata**: reads `fabric.mod.json`, `quilt.mod.json`, Forge's `META-INF/mods.toml` / `neoforge.mods.toml`, and legacy `mcmod.info` straight out of the jar to show real names/versions/descriptions, and auto-tags mods (`performance`, `pvp`, `visual`, `library`, ...) by keyword.
- **Presets**: one click to bulk-switch mods by category - Smooth PvP, Crystal PvP, UHC, Bedwars, Survival, or Visual/HUD-only - driven by a single tag→preset map (`MOD_TAG_PRESETS` in `shared/types.ts`), so adding another preset is a one-line change, not new UI code.
- **Smooth PvP JVM tuning**: optional G1GC flag preset (Aikar's-flags-style) aimed at cutting GC-pause frame hitches, which matter most in close-quarters PvP.
- **Offline play**: launches with a deterministic offline UUID (same algorithm the vanilla launcher uses), no Microsoft/Mojang auth and no network calls at launch time.
- **Real launch engine**: resolves Forge/Fabric version JSON inheritance chains, merges libraries/arguments, extracts natives, builds the classpath, and spawns the JVM directly — not a wrapper around another launcher.
- **Per-mod config editor**: click **Configure** on any mod to edit its actual config file (JSON or Forge-style TOML) from a schema-inferred form, no text editor required. Works on any mod that follows the standard `config/<modid>.toml` / `config/<modid>.json` convention.
- **Bundled companion mod** (`mod/`): a small Fabric client mod, also called "Omega Client", with an in-game toggle menu for visual/QoL PvP settings plus a WorldEdit-style schematic selection/save/ghost-preview tool — see [`mod/README.md`](mod/README.md).

## Project layout

```
src/
  shared/types.ts        # types shared between main and renderer processes
  main/                  # Electron main process (Node, has filesystem/process access)
    store.ts             # JSON persistence (instances + settings) in userData
    instances.ts         # instance CRUD, installed-version detection
    modMetadata.ts        # jar metadata parsing (fabric.mod.json / mods.toml / mcmod.info)
    mods.ts               # mod scan/import/enable-disable/preset logic
    toml.ts               # minimal TOML subset parser/serializer
    modConfig.ts           # per-mod config file discovery + read/write (JSON + TOML)
    java.ts               # local Java runtime discovery
    versionResolver.ts    # version JSON inheritance, rule evaluation, arg templating
    launch.ts             # natives extraction, classpath build, JVM spawn
    main.ts / preload.ts  # window + IPC wiring
  renderer/               # React UI (Vite)
    pages/, components/    # incl. ConfigModal (schema-inferred config editor), ToastHost
mod/                      # companion Fabric client mod - see mod/README.md
```

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev        # starts Vite + Electron in dev mode with hot reload
```

## Building a Windows .exe

```bash
npm run build       # compiles renderer (Vite) + main process (tsc)
npm run dist:win     # packages via electron-builder -> release/ (portable .exe + NSIS installer)
```

`dist:win` must be run on (or cross-compiled for) Windows for a fully signed/native build; electron-builder can cross-package from Linux/macOS for basic portable builds but a native Windows run is recommended for the final release artifact.

## Using it

1. **Settings** → set a default Java path (or leave blank to use `java` on PATH) and default RAM.
2. **New Instance** → browse to your existing Minecraft folder (the one with `versions/`, `libraries/`, `assets/` — this is `%APPDATA%\.minecraft` by default on Windows). The launcher scans it and lists every installed version + detected loader.
3. Pick a version, name the instance, create it.
4. In the instance's **Mods** tab, click **Import your mods** and select the `.jar` files from your existing mods collection — they show up immediately as toggle rows with parsed name/version/tags.
5. Flip mods on/off, or use a preset button (Smooth PvP, Crystal PvP, UHC, Bedwars, Survival, Visual/HUD only) to bulk-switch by tag - presets only affect mods you've actually imported and tagged; the launcher doesn't ship any mods itself.
6. Click **Configure** on any mod to edit its settings without leaving the launcher (only works once the mod has generated a config file - usually after its first run).
7. Hit **Play**. Console output streams live in the **Console** tab; **Stop** kills the process.

## Design notes / constraints

- **No bundled mods.** The launcher never ships or downloads third-party mod jars — you bring your own. This keeps it clear of any mod's own license/distribution terms.
- **No installer/downloader for Minecraft itself.** Reimplementing Mojang's asset/library downloader and Forge/Fabric installers is a large, security-sensitive undertaking; instead the launcher works with an install you already have (via the official launcher or MultiMC-style tools), which is also what makes it "no online servers" — the only network activity is whatever *you* already did to install the game.
- **Offline auth only.** No Microsoft/Mojang OAuth flow is implemented. This is intentional for the "no online servers" requirement; it also means it won't join servers with `online-mode=true` unless you add that later.
- **Mods folder = instance run directory's `mods/`.** Each instance's effective "game directory" passed to the JVM is the parent of its mods folder, so per-instance isolation falls out naturally if you ever point an instance's mods folder outside the shared install (not yet exposed in the UI, but the launch engine already supports it).
- **The config editor doesn't preserve comments.** Saving through the UI regenerates the file from parsed data (JSON round-trips exactly; the TOML writer doesn't keep hand-written `#` comments). The UI warns about this before you save a TOML file.
- **The companion mod is visual/QoL only, by design.** Fullbright, block highlighting, FOV/zoom, toggle-sprint, the info HUD, and the schematic tool - nothing that reveals info through walls (highlighting/preview are depth-tested) and nothing that automates combat input (no reach/velocity/aim changes). See [`mod/README.md`](mod/README.md) for the reasoning and exact feature list.
- **Presets are a tag→mods mapping, not a mod source.** "Crystal PvP", "UHC", "Bedwars", etc. only ever act on mods you've imported; the launcher recognizes them via keyword-based auto-tagging (`modMetadata.ts`), which is a heuristic and won't catch every mod's real purpose - check a mod's tags after importing it if a preset doesn't pick it up as expected.

## Possible next steps

- Per-instance isolated `mods`/`saves`/`config` folders exposed in the New Instance UI (the launch engine already supports arbitrary `modsDir`).
- Drag-and-drop mod import onto the mod list.
- A "verify install" pass that flags missing libraries/assets before launch instead of only warning in the console.
- Optional Microsoft auth for online-mode servers, kept strictly opt-in.
