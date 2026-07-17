<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->
# Omega Client

*The last client you will ever need.*

A lightweight Minecraft launcher focused on **smooth performance**, **PvP**, and **one-click mod toggling**. Signing in with a real Microsoft account is required to use it (works out of the box, no setup needed - see below), the same as Lunar/Feather-style launchers. No launcher-hosted backend of any kind — it installs Minecraft (vanilla/Fabric/Forge) straight from Mojang's and the loaders' own servers or drives an install you already have, manages mods as simple on/off switches, and talks to Microsoft/Xbox/Mojang's own servers directly to authenticate, nowhere else.

## Why this exists

Most launchers either lock you into vanilla, or require full manual `mods/` folder surgery to A/B test a modpack. This launcher works with any standard `versions/` / `libraries/` / `assets/` layout — an install you already have (official launcher, MultiMC, Prism, manual) or a fresh one it downloads itself from Mojang's own CDNs — and layers instance management + mod toggles + PvP-tuned JVM flags on top. Everything comes straight from Mojang's/the loaders' own servers; nothing is re-hosted.

## Features

- **Instances**: point at any existing Minecraft install folder, auto-detects installed versions and their loader (vanilla/Forge/Fabric/Quilt/NeoForge) by reading the version JSON.
- **Built-in installer**: or start from an empty folder — the New Instance dialog downloads any Minecraft release straight from Mojang, with one-click Fabric (via Fabric's meta API) or Forge (via the official installer, run headlessly) on top. Live progress, sha1-verified downloads, resumable/idempotent.
- **Mod toggles**: import your own mod `.jar`s and flip them on/off per-instance with a switch. Disabling renames `mod.jar` → `mod.jar.disabled`, which every loader already ignores — no destructive moves, nothing leaves the folder.
- **Mod discovery**: the Mods tab's **Discover** view browses Modrinth in-launcher — it opens on the most-downloaded mods compatible with the instance's Minecraft version + loader (no search needed to see anything) and keeps loading more as you scroll, so the whole compatible catalog is browsable; a search box narrows from there, and **Install** drops the latest compatible build (plus its required dependencies) straight into the instance's mods folder as a normal toggle row.
- **Automatic mod metadata**: reads `fabric.mod.json`, `quilt.mod.json`, Forge's `META-INF/mods.toml` / `neoforge.mods.toml`, and legacy `mcmod.info` straight out of the jar to show real names/versions/descriptions, and auto-tags mods (`performance`, `pvp`, `visual`, `library`, ...) by keyword.
- **Presets**: one click to bulk-switch mods by category - Smooth PvP, Crystal PvP, UHC, Bedwars, Survival, or Visual/HUD-only - driven by a single tag→preset map (`MOD_TAG_PRESETS` in `shared/types.ts`), so adding another preset is a one-line change, not new UI code.
- **Smooth PvP JVM tuning**: optional G1GC flag preset (Aikar's-flags-style) aimed at cutting GC-pause frame hitches, which matter most in close-quarters PvP.
- **Microsoft sign-in required**: the launcher gates everything (instances, settings, all of it) behind linking a real Minecraft account, via the standard Microsoft OAuth → Xbox Live → Minecraft token chain, the same public flow every third-party launcher uses. This works immediately with no setup - it ships its own Azure app registration, the same shared-client-id model MultiMC/Lunar/Feather-style launchers use - see "Microsoft sign-in" below for the (optional) steps to use your own instead. Tokens are encrypted at rest (Electron's OS-level `safeStorage`) and refreshed automatically before each launch.
- **Real launch engine**: resolves Forge/Fabric version JSON inheritance chains, merges libraries/arguments, extracts natives, builds the classpath, and spawns the JVM directly — not a wrapper around another launcher.
- **Per-mod config editor**: click **Configure** on any mod to edit its actual config file (JSON or Forge-style TOML) from a schema-inferred form, no text editor required. Works on any mod that follows the standard `config/<modid>.toml` / `config/<modid>.json` convention.
- **Built-in features, Lunar-style** (`mod/`): the Omega companion mod (Fabric + Forge builds) ships inside the launcher and is preinstalled into every instance automatically — fullbright, combat-clarity block highlighting, FOV/zoom, toggle-sprint, no-hurt-cam, no-fog, clear weather, a weather/time changer, info HUD, granular particle control, and a WorldEdit-style schematic tool. Every toggle lives entirely in-game (Right Shift, or the Omega button in the pause menu) - the launcher itself has no Features screen at all, so there's exactly one place in charge of the config file — see [`mod/README.md`](mod/README.md).
- **Shader support**: a compatible shader loader (Iris + Sodium on Fabric, Oculus on Forge) is fetched from Modrinth and preinstalled alongside the Omega mod, the same way Fabric API is. Import `.zip` shader packs from the **Shaders** tab; pick the active one in-game under Video Settings → Shader Packs (that menu lives inside the game, the launcher can't drive it).

## Project layout

```
src/
  shared/types.ts        # types shared between main and renderer processes
  main/                  # Electron main process (Node, has filesystem/process access)
    store.ts             # JSON persistence (instances + settings) in userData
    instances.ts         # instance CRUD, installed-version detection
    modMetadata.ts        # jar metadata parsing (fabric.mod.json / mods.toml / mcmod.info)
    mods.ts               # mod scan/import/enable-disable/preset logic
    modDiscovery.ts       # in-launcher mod browsing/search/install (Modrinth)
    toml.ts               # minimal TOML subset parser/serializer
    modConfig.ts           # per-mod config file discovery + read/write (JSON + TOML)
    java.ts               # local Java runtime discovery
    versionResolver.ts    # version JSON inheritance, rule evaluation, arg templating
    launch.ts             # natives extraction, classpath build, JVM spawn
    msAuth.ts              # Microsoft OAuth -> Xbox Live -> Minecraft token chain
    accountStore.ts        # encrypted-at-rest account storage, token refresh
    main.ts / preload.ts  # window + IPC wiring
  renderer/               # React UI (Vite)
    pages/, components/    # incl. ConfigModal (schema-inferred config editor), ToastHost
mod/                      # companion mod: common/ (shared data classes) + fabric/ + forge/ - see mod/README.md
```

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev        # starts Vite + Electron in dev mode with hot reload
```

## Building

**No local build needed**: every push runs the GitHub Actions "Build" workflow (`.github/workflows/build.yml`), which packages the launcher for **Windows** (`OmegaClient-Portable.exe` + `OmegaClient-Setup.exe` installer), **macOS** (`OmegaClient-*.dmg` + `.zip`), and **Linux** (`OmegaClient-*.AppImage`), builds both companion-mod jars, and publishes everything to the rolling [`latest-build` release](https://github.com/dsdocai-ops/Mods/releases/tag/latest-build).

Windows is the flagship, most-tested target and gates the release; macOS/Linux are newer, best-effort additions that publish alongside Windows when they succeed but never block it (same "must never block the others" treatment the mod-jars build already gets - see the workflow file's top comment). None of the three are code-signed: Windows shows a SmartScreen warning, macOS's Gatekeeper blocks a fresh install (right-click → Open past it once), and the AppImage needs `chmod +x` before it'll run on most distros.

**Auto-updates**: launchers installed via `OmegaClient-Setup.exe` (Windows) or the macOS/Linux builds check the rolling release on startup (electron-updater, generic provider - CI stamps each build `0.1.<run number>` and regenerates the platform-specific `latest*.yml`), download the new build in the background, and apply it on the next restart (a banner offers "Restart now"). The Windows portable exe can't replace itself in place - portable users just re-download. The startup check is configurable in **Settings → Updates** (on by default); a "Check for updates now" button there works regardless of the toggle.

To build locally instead:

```bash
npm run build        # compiles renderer (Vite) + main process (tsc)
npm run dist:win      # -> release/ (portable .exe + NSIS installer)
npm run dist:mac      # -> release/ (dmg + zip) - must run on macOS (dmg creation needs hdiutil)
npm run dist:linux    # -> release/ (AppImage)
```

Each target should run on (or, for the simpler ones, be cross-compiled for) its own platform for the most reliable result - `dist:mac` in particular needs to run on real macOS, since dmg creation shells out to `hdiutil`.

## Microsoft sign-in

Signing in is required - the launcher shows a full-screen "Sign in with Microsoft" prompt on first run and blocks everything else until you do. This works immediately, no setup needed: the launcher ships its own Azure AD app registration (a *public* client id, not a secret - safe to embed, see below), the same shared-client-id model MultiMC/Lunar/Feather-style launchers use.

Using your own Azure app registration instead (optional - e.g. if you're distributing your own fork and don't want to share sign-in quota with the upstream build):

1. Go to **portal.azure.com** → **App registrations** → **New registration**.
2. Name it anything.
3. **Supported account types**: select **"Accounts in any organizational directory and personal Microsoft accounts"** (required - Minecraft logins are personal accounts).
4. **Authentication** → **Add a platform** → **Mobile and desktop applications** → check `https://login.microsoftonline.com/common/oauth2/nativeclient` → Save.
5. Still on **Authentication**: set **"Allow public client flows"** to **Yes** → Save. (No client secret needed - a secret shipped in desktop app code isn't actually secret, so this app is registered as a public/native client using PKCE instead.)
6. Copy the **Application (client) ID** from the **Overview** page.
7. In the launcher: **Settings** → paste it into **"Microsoft sign-in client ID"**, replacing the shipped default → **Save**.

Once signed in, every instance uses the signed-in account automatically - there's no offline mode to opt out into. If you've linked more than one account, the account switcher next to the **Play** button (or the **Account** dropdown in an instance's **Instance Settings** tab) picks which one an instance uses.

Minecraft has no way to hot-swap a live session mid-game, so the mod's in-game menu can't switch accounts on its own either - its **Switch Account** button (double-click to confirm) just quits cleanly and signals the launcher, which pops back to the foreground with its account switcher already open so you can pick the next account and relaunch.

## Using it

1. **Settings** → set a default Java path (or leave blank to use `java` on PATH) and default RAM.
2. **New Instance** → browse to your existing Minecraft folder (`%APPDATA%\.minecraft` by default on Windows) to use what's already installed — or pick any empty folder and use **Install new version** to download a fresh Minecraft + Fabric/Forge right there.
3. Pick a version, name the instance, create it.
4. In the instance's **Mods** tab, open **Discover** to browse/search Modrinth mods compatible with the instance and install them in one click — or click **Import your mods** and select the `.jar` files from your existing mods collection. Either way they show up as toggle rows with parsed name/version/tags.
5. Flip mods on/off, or use a preset button (Smooth PvP, Crystal PvP, UHC, Bedwars, Survival, Visual/HUD only) to bulk-switch by tag - presets only affect mods you've actually imported and tagged; the launcher doesn't ship any mods itself.
6. Click **Configure** on any mod to edit its settings without leaving the launcher (only works once the mod has generated a config file - usually after its first run).
7. Hit **Play**. Console output streams live in the **Console** tab; **Stop** kills the process.

## Design notes / constraints

- **The Omega mod is built in, Lunar-style.** The launcher ships with its own companion mod jars (CI stages them into the packaged app via electron-builder `extraResources`; dev clones fall back to fetching them from the repo's rolling release) and (re)installs the right one into every Fabric/Forge instance on creation and before every launch — its features are launcher features, edited first-class in the **Features** tab (which reads/writes the same `config/omega-client.json` the in-game Right Shift menu uses). Disabling it in the Mods tab is respected: the refresh updates the `.disabled` file instead of re-enabling it. Three dependency jars we don't own are fetched from Modrinth (the distribution platform built for exactly this) the same way, cached per MC version, and only when an instance lacks one: Fabric API (Fabric builds need it to run at all), and a shader loader — Iris + Sodium on Fabric, Oculus on Forge — so shaderpacks work out of the box (see the **Shaders** tab). Beyond those, nothing else is bundled or downloaded on the launcher's own initiative — other mods only arrive when you import your own jars or explicitly install one from the Mods tab's **Discover** view (which fetches from the same Modrinth API).
- **Built-in installer, three paths with different mechanics.** Vanilla installs are pure HTTP against Mojang's own piston-meta/resources CDNs (sha1-verified); Fabric rides its meta API's ready-made profile JSON; Forge has no HTTP-only path (its installer runs binary patchers), so the launcher downloads the official Forge installer and runs it headlessly with your Java - the same approach every third-party launcher takes. The vanilla download path is runtime-verified by CI on every push (`scripts/install-smoke.cjs` installs a real copy of 1.20.1 on GitHub's runners); the Fabric/Forge paths follow the same documented, stable endpoints but haven't been exercised end-to-end yet.
- **Every launch is preceded by a real install-completeness check**, not just a hopeful attempt. `main/installVerify.ts` compares the resolved version's required libraries and client jar against what's actually on disk before `launch.ts` ever spawns Java - a missing library or client jar now fails immediately with one clear "re-run Install to repair it" message instead of a cryptic `NoClassDefFoundError` buried in the Console tab. Missing asset objects (broken textures/sounds, not a hard crash) are reported the same way but don't block the launch.
- **Microsoft sign-in is required, Lunar/Feather-style.** `App.tsx` gates the entire launcher (sidebar, instances, settings - everything) behind linking at least one Microsoft account; there's no offline-play option anymore. This works out of the box - `store.ts`'s default `msaClientId` ships a real, working Azure AD app registration (public client, personal-Microsoft-accounts-only, no secret involved - PKCE is specifically designed to make an embedded client id safe), the same shared-client-id model MultiMC/Lunar/Feather-style launchers use; still overridable in Settings for anyone who'd rather use their own registration. The OAuth/Xbox/Minecraft token chain in `msAuth.ts` is a public, stable, well-documented REST flow (the PKCE code-challenge step is verified against the official RFC 7636 test vector, and the authorize request itself was confirmed live against Microsoft's real endpoint - it correctly redirects to a genuine sign-in page); it has not been exercised through an actual interactive login, since that needs a live human+browser this environment can't perform. Tokens are encrypted at rest via Electron's `safeStorage` (OS keychain/DPAPI/libsecret) and refreshed automatically before each launch. Because this ships as one shared client id, it inherits the same known trade-off MultiMC hit historically: Microsoft's per-app sign-in rate limits apply across every user of this build combined, and Microsoft can throttle/revoke a shared id if abused.
- **Mods folder = instance run directory's `mods/`.** Each instance's effective "game directory" passed to the JVM is the parent of its mods folder, so per-instance isolation falls out naturally if you ever point an instance's mods folder outside the shared install (not yet exposed in the UI, but the launch engine already supports it).
- **The config editor doesn't preserve comments.** Saving through the UI regenerates the file from parsed data (JSON round-trips exactly; the TOML writer doesn't keep hand-written `#` comments). The UI warns about this before you save a TOML file.
- **The companion mod is visual/QoL only, by design.** Fullbright, block highlighting, FOV/zoom, toggle-sprint, no-hurt-cam, no-fog, clear weather, the info HUD (coords/FPS/ping/direction/CPS/keystrokes), and the schematic tool - nothing that reveals info through walls (highlighting/preview are depth-tested) and nothing that automates combat input (no reach/velocity/aim changes; the CPS counter reads clicks, never makes them). See [`mod/README.md`](mod/README.md) for the reasoning and exact feature list.
- **Presets are a tag→mods mapping, not a mod source.** "Crystal PvP", "UHC", "Bedwars", etc. only ever act on mods you've imported; the launcher recognizes them via keyword-based auto-tagging (`modMetadata.ts`), which is a heuristic and won't catch every mod's real purpose - check a mod's tags after importing it if a preset doesn't pick it up as expected.

## Monetization

Two independent monetization paths, both opt-in and neither gating any core launching/modding functionality - keeping this clearly on the right side of Mojang's usage guidelines (nothing required to use the launcher is paywalled or ad-gated).

**Sponsor placements.** The Welcome screen and Settings both render every entry in `shared/affiliates.ts`'s `SPONSOR_PLACEMENTS` array (currently one: a "Need a practice server?" card recommending Apex Hosting), each paired with an explicit affiliate-link disclosure - required by FTC-style disclosure rules and Minecraft's own usage guidelines around not implying endorsement. Apex was picked after comparing commission rates *and* payout reliability across the major Minecraft-hosting affiliate programs; a couple of competitors advertise higher headline commissions but have documented reports of withheld/disappeared affiliate balances, which made Apex's smaller-but-recurring, actually-paid-out commission the better real choice. Every placement's link opens in the system browser via a `shell.openExternal` IPC call restricted to `https://` URLs (`external:open` in `main.ts`) - the renderer never gets to pass it an arbitrary URL, only the hardcoded ones in `shared/affiliates.ts`. More placements get added to that array as they're set up, not invented ahead of time. `SponsorCard.tsx` renders whatever's in the array, so adding one is a one-line data change, not a code change.

**Paid cosmetics.** Settings' Cosmetics section has a "Buy a cosmetic" button (a hardcoded link in `shared/cosmetics.ts`, same restricted-to-`https://` `external:open` path as sponsor placements) and a license-key redeem field - paste in the key you're given after buying, and it unlocks a cosmetic badge other Omega Client players see next to your name in-game (same nametag mechanism as the free Ω presence badge - needs a server/proxy relaying the presence channel either way). On redemption, `unlockCosmetic()` (`main/licensing.ts`) persists the cosmetic to a local `licenses.json` and stamps `ownedCosmeticId` into every instance's `config/omega-client.json`, the same file the in-game Right Shift menu reads/writes.

**Known, accepted limitation**: like every other toggle in this app, this isn't backed by server-side enforcement - a hand-edited config can grant a cosmetic without paying, exactly as it could already flip `fullbrightEnabled`. Proportionate to a vanity-only feature, consistent with this project generally not attempting anti-tamper enforcement. `mod/common/.../presence/CosmeticCatalog.java` currently ships two placeholder badge colors (`gold_badge`, `azure_badge`) so the pipeline is testable end to end; real cosmetic art/ids are a content decision, not a code change.

An optional cloud-sync subscription was also scoped as a viable next step but is a meaningfully bigger undertaking than either of the above - not started.

## Possible next steps

- **NeoForge support**: `mod/` now covers Fabric + Forge; NeoForge (a fork of Forge with a similar but not identical API) would be a third module following the same pattern.
- Per-instance isolated `mods`/`saves`/`config` folders exposed in the New Instance UI (the launch engine already supports arbitrary `modsDir`).
- Drag-and-drop mod import onto the mod list.
