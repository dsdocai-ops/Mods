# Omega Client (companion mod - Fabric + Forge)

*The last client you will ever need.*

A small client mod that adds an in-game toggle menu for visual/QoL PvP settings, built for **both Fabric and Forge**. It's designed to be installed like any other mod through the Omega Client launcher's **Import your mods** button, and its config file (`config/omega-client.json`) is a plain JSON file the launcher's **Configure** button can already edit.

Open the menu in-game with **Right Shift** (rebindable in vanilla's Controls screen, under "Omega Client").

## Project layout

```
mod/
  common/    # SchematicData, SchematicBlockEntry, SessionInfo, ParticleCategory - the ONLY code shared between loaders (see below)
  fabric/    # Fabric build - mod id "omega-client"
  forge/     # Forge build - mod id "omega_client_forge" (Forge disallows hyphens in mod ids)
```

Each loader module has its own full implementation of every feature (ModConfig, FullbrightFeature, the schematic tool, etc.) - **not** a single shared implementation. Here's why: Fabric mods are conventionally written against Yarn mappings (community-maintained names for Minecraft's classes), Forge mods against Mojang's own official mappings - different names for the same underlying game classes. Naively sharing source between a Yarn-mapped module and an officially-mapped one isn't safe without a remapping layer (that's literally what the Architectury Loom toolchain exists to solve). Since this project has no way to test-verify a Gradle setup that complex, the lower-risk choice was two independent, loader-idiomatic implementations, sharing only the classes with zero Minecraft API surface at all (`SchematicData`, `SchematicBlockEntry`, `SessionInfo`, `ParticleCategory` - plain data/logic holders, safe to compile once and use from both). If you want true single-source multi-loader builds later, adopting Architectury for this project is the natural next step.

This mod is otherwise **zero-Mixin by design** - every other feature reads/writes plain client-option fields or hooks a documented Fabric API / Forge event, deliberately avoiding the extra fragility of bytecode-injection tooling in a project with no way to compile-verify it. Particle control (see below) is the one place that turned out to be genuinely impossible without it, and is called out everywhere it matters.

Both modules now **compile clean against real Minecraft classes in CI** (see "Building" below) - the Fabric module on its first attempt, the Forge module after two rounds of corrections that all landed on pre-flagged spots. Compiling isn't the same as runtime-tested, but the "wild guess" phase of the Forge port is over.

## What it does - and deliberately doesn't

Every feature here is a visual or convenience setting, nothing that reads information the player couldn't already get, and nothing that automates input:

| Feature | What it actually does |
|---|---|
| **Fullbright** | Raises the gamma option past vanilla's UI-enforced 0-1 slider range. Purely a brightness override, same technique used by countless QoL mods. |
| **Block Highlight** | Draws a wireframe outline around configured block types (defaults: obsidian, respawn anchor, crying obsidian) within 20 blocks. Rendered with the same depth-tested "lines" layer vanilla's own F3+B hitbox debug view uses - **terrain still occludes it**. This is "combat clarity" (see anchors/crystals you're already looking near more easily), not X-ray: it will never show a block through a solid wall. |
| **Custom FOV / Zoom** | Same no-mixin technique as fullbright, applied to the FOV option. Zoom is hold-to-zoom via a keybind (default **C**). |
| **Toggle Sprint** | Keeps you sprinting while holding forward, so you don't need double-tap or a sprint-lock keybind from another mod. Doesn't change movement speed or add anything beyond vanilla sprinting. |
| **Info HUD** | Coordinates, FPS, and a WASD+space+click keystroke display. All of this is already visible via vanilla's F3 debug screen - this is just an always-on, friendlier subset of it. |
| **Schematics** | A WorldEdit-style two-point selection, save-to-file, and ghost-preview tool, plus a best-effort Litematica `.litematic` file importer - see below. |
| **Particle control** | Per-category on/off switches (block, ambient block, totem, crit, explosion, portal), a free-form blacklist for anything else, and a density slider to thin out whatever's left. Purely visual/performance tuning, same spirit as vanilla's own Particles option, just more granular - see below. |

**Intentionally not included**, because they cross from "visual setting" into "unfair advantage against other players" and most servers treat them as cheating: reach/hitbox expansion, aimbot/kill-aura, auto-clicking, velocity or knockback modification, X-ray (seeing blocks *through* terrain), and anything that reads server-side information the client wouldn't normally have.

Using visual settings like fullbright on a server that specifically disallows them can still get you moderated - check the rules of wherever you're playing.

## Default keybinds

Identical on both loaders, rebindable in vanilla's Controls screen under "Omega Client". `Toggle Preview` and `Re-anchor to Me` ship unbound by default (`Schematics...` in the menu covers both) so they don't collide with anything without you choosing them yourself.

| Action | Default key |
|---|---|
| Open menu | Right Shift |
| Zoom (hold) | C |
| Schematic: set Position 1 | O |
| Schematic: set Position 2 | P |
| Schematic: toggle preview | *unbound* |
| Schematic: re-anchor to me | *unbound* |

## Schematics

A small WorldEdit/Litematica-style building tool: select a region, save it, then load it back later as a ghost-preview overlay to build against. Works identically on both loaders, and `.omschem.json` files are interchangeable between the two builds (same format, same folder location).

1. Look at one corner block and press **O** (Position 1), then the opposite corner and press **P** (Position 2). Both get an action-bar confirmation.
2. Open the menu (**Right Shift**) → **Schematics...**, type a name, and hit **Save Selection**.
3. To build from it later: open **Schematics...**, click the saved name to load and start previewing it, stand where you want its corner to land, and click **Re-anchor to Me**.

**Saving does not write the real Litematica `.litematic` file format.** That format is proprietary, undocumented binary NBT (bit-packed per-block-state arrays, sub-region support, etc.), and this project has no way to verify byte-for-byte *write* compatibility with it without a real game session to test against - getting it subtly wrong would produce files that silently don't work in actual Litematica. Instead, saving/previewing uses Omega Client's own format ("Omega Schematic", `.omschem.json` - plain, human-readable JSON via Gson) that does the same *job* without claiming write-compatibility it can't back up. Files live in `<config>/omega-client/schematics/`. Full block state (orientation, waterlogged, stair shape, etc.) is captured, not just the block type - see `BlockStateCodec.java` in each loader module.

**Importing real `.litematic` files is supported, best-effort.** Drop `.litematic` files into `<config>/omega-client/schematics/import/` and they'll show up as "Import: filename.litematic" buttons in the Schematics screen; clicking one converts and saves it as a normal Omega Schematic. Unlike everything else in this mod, `LitematicaImporter.java` isn't built on documented/stable Minecraft APIs - it's reconstructed from memory of how the Litematica format is commonly described (community write-ups, other third-party readers), since the format itself is undocumented and this project has no real `.litematic` file to test against. The bit-unpacking *arithmetic* is verified correct via an isolated round-trip simulation (shift/mask math has no bugs), but whether it matches Litematica's *actual* on-disk layout is unverified. Concretely:
- Only the first region in a file is imported (Litematica's multi-region support is out of scope here).
- A failed/wrong-looking import shows an error message rather than crashing your game (defensive by design, given the uncertainty above) - always eyeball an imported schematic's preview before building from it.
- If it doesn't work for your file, the most likely culprits are the exact `BlockStatePalette`/`BlockStates` NBT tag names, or Litematica having changed its bit-packing scheme between versions.

**The ghost preview is color-coded wireframe outlines, not real block textures.** Textured block rendering exists in the Minecraft client but calling it correctly is another spot this project can't compile-verify, so the preview reuses the same depth-tested wireframe technique as Block Highlight instead (each exact block state gets a consistent deterministic color, so different materials/orientations are still distinguishable) - see `SchematicRenderFeature.java` in each loader module.

## Account switching

The menu's header shows "Playing as: {username} ({microsoft|offline})", read from a small JSON session file (`omega-client-session.json`) the Omega Client launcher writes into the game directory right before spawning the game - see `SessionInfo.java` in `common/` and each loader's `SessionInfoLoader.java`.

Minecraft has no API for hot-swapping a live account mid-session, so **"Switch Account" doesn't actually switch anything in-game** - clicking it (twice, to confirm) writes a marker file (`omega-client-switch-account.request`) into the game directory and then quits the client (`MinecraftClient.scheduleStop()` on Fabric, `Minecraft.stop()` on Forge - a clean, same-tick shutdown request, not `System.exit()`). The launcher watches for that marker file after its spawned game process exits and, if present, brings itself to the foreground and reopens its own account switcher automatically. Both sides only ever communicate through these two files - there's no socket or IPC channel between the launcher and a running game.

## Particle control

Open the menu (**Right Shift**) → **Particles...** for:
- **A master switch** - turns every particle off, full stop. Two Mixin injections back this, not one: the normal type-classified spawn path (`addParticle(ParticleEffect, ...)` / `createParticle(ParticleOptions, ...)`), plus a second, category-blind injection on the lower-level `addParticle(Particle)` / `add(Particle)` overload that a handful of vanilla effects use to spawn already-constructed child particles directly (bypassing type lookup entirely, e.g. some particles spawning their own children from `tick()`). Only the master switch can act on that second path - a raw `Particle` object doesn't carry the type info a category check needs - but it's covered, so "All particles: OFF" actually means all of them, not "most, from the normal spawn path." Turning it off stops new particles from appearing immediately; particles already alive at that moment still finish their remaining lifetime rather than vanishing instantly (typically under a second, up to a few seconds for slow ones like smoke).
- **Six category switches** - Block (the generic break/step/land particle - "particles for every block"), Ambient block (torch smoke, drips, spores, and similar decorations), Totem, Crit (crit + enchanted-hit), Explosion, and Portal.
- **A custom blacklist** - type any particle id (e.g. `minecraft:soul`, or just `soul` and it'll assume `minecraft:`) to block something the categories above don't cover - the "and more" from the original request.
- **A density slider** (cycles 100% → 75% → 50% → 25% → 10%) - probabilistically thins whatever's still allowed through, instead of an all-or-nothing cut.

Settings are per-category, not per-block - "turn off particles for every block" means the Block/Ambient switches, not a thousand individual block toggles. Use the blacklist for anything more specific.

**This is the mod's one deliberate exception to being otherwise zero-Mixin.** There's no documented Fabric API event or Forge event for cancelling an individual particle spawn by type, and every non-Mixin alternative considered (replacing the client's particle-manager instance, or reflectively wrapping its registered particle factories) is strictly more fragile - both depend on reproducing or racing against internal state that gets rebuilt on every resource pack reload. A single injection at the front of the one real choke point - every particle spawn in the game funnels through `ParticleManager#addParticle` (Fabric) / `ParticleEngine#createParticle` (Forge) - is the smaller, more standard risk; it's a well-established target for real particle-control mods, not a novel hack. See `ParticleManagerMixin.java` (Fabric) and `ParticleEngineMixin.java` (Forge).

The classification itself (which category a given particle id falls into) is pure string matching in `common/ParticleCategory.java` and is deliberately conservative - unrecognized ids (including anything from a modded namespace) fall through as uncategorized and are only affected by the master switch, blacklist, and density slider, never silently lumped into the wrong category. The per-spawn check is written to allocate nothing in the common case (master on, no blacklist, density 100%) since it runs on every particle, every frame - see the hot-path note in `ParticleFilter.java`.

On the Fabric side, adding this Mixin needed no extra Gradle wiring - Fabric Loom bundles Mixin annotation processing (and refmap generation) already, the mod just needed a `.mixins.json` and a `"mixins"` entry in `fabric.mod.json`. Forge needed real Gradle changes: an `annotationProcessor` dependency on SpongePowered's Mixin, a `[[mixins]]` entry in `mods.toml`, and the official MixinGradle plugin (`org.spongepowered.mixin`) to generate the SRG refmap - Forge 1.20.1 runs SRG names in production (only dev environments use official mappings), so the refmap is genuinely required. An earlier version of this setup tried to skip refmap generation with a compiler flag; the first real CI compile rejected that immediately, which is exactly the kind of correction the risk-flagging in this README exists to invite.

## Building

**Both loader modules now compile clean against real Minecraft/Fabric/Forge classes** - verified by the repo's GitHub Actions workflow (`.github/workflows/build.yml`), which produces both jars as downloadable artifacts on every push. The Fabric module compiled on its very first real-classpath attempt; Forge needed two rounds of fixes, every one landing on a spot the lists below had pre-flagged (the particle Mixin's method signature/refmap wiring, `Options.gamma`/`fov` accessors, `Property.getName`/`getValue`).

What remains genuinely unverified is **runtime behavior**: compiling proves the API names and signatures are right, not that a feature behaves correctly in a live game session (rendering looks right, keybinds feel right, the Litematica importer parses real files). The "spots to check" lists below are kept for that reason - they're now ranked evidence of what was risky, and the remaining runtime-only risks (especially `LitematicaImporter.java`) still stand.

Build one or both:

```bash
cd mod
gradle :fabric:build     # -> fabric/build/libs/omega-client-fabric-0.1.0.jar
gradle :forge:build      # -> forge/build/libs/omega-client-forge-0.1.0.jar
```

No Gradle wrapper is checked in (the sandbox that generated this project couldn't validate the wrapper's distribution URL through its proxy) - use a local Gradle install, or open the project in IntelliJ IDEA with the Minecraft Development plugin, which sets one up automatically.

Requirements:
- JDK 17+
- Network access to `maven.fabricmc.net` + Mojang's piston-meta (Fabric), or `maven.minecraftforge.net` + Mojang's piston-meta (Forge)

### Fabric: spots to check first if it doesn't compile

Roughly in order of how likely they are to have drifted:
- `LitematicaImporter.java` - the whole file, undocumented third-party format, see "Schematics" above.
- `Property.name(value)` / `Property.parse(text)` and `StateManager.getProperty(name)` in `BlockStateCodec.java`.
- `NbtIo.readCompressed(InputStream)` in `LitematicaImporter.java` - some MC versions require an extra `NbtSizeTracker` argument.
- `GameOptions.getGamma()` / `getFov()` in `FullbrightFeature.java` / `FovZoomFeature.java`.
- `ClientPlayerEntity.sendMessage(Text, boolean)` in `OmegaClient.java`.
- `MinecraftClient.scheduleStop()` in `ClickGuiScreen.java` (account switching) - this one's lower-risk than most of this list, it's a long-standing Yarn name with no known history of changing.
- `ParticleManager#addParticle(ParticleEffect, double,double,double,double,double,double)` and `ParticleManager#addParticle(Particle)`'s exact method descriptors in `ParticleManagerMixin.java` (particle control) - if either signature has drifted, Mixin fails loudly at startup (the config is `"required": true`) rather than silently doing nothing, so a broken match is easy to notice.

Your IDE's autocomplete on `client.options.`, `player.sendMessage(`, `block.getStateManager().`, or `NbtIo.` will show the real signatures for your exact `yarn_mappings` build if any of these have drifted.

### Forge: spots to check first if it doesn't compile

This list is longer than Fabric's because every file in `forge/` is a fresh, never-checked translation from Yarn names to Mojang's official mappings - not a difference in the underlying logic, just more surface area that's never touched a real compiler:

- **`OmegaClientForge.java`'s event wiring** - the highest-risk spot in the whole module. Forge's client rendering and HUD-overlay APIs changed shape more than once across the 1.20.x line. `RegisterGuiOverlaysEvent`/`event.registerAboveAll(...)`, `RenderLevelStageEvent`/`Stage.AFTER_TRANSLUCENT_BLOCKS`, and `TickEvent.ClientTickEvent` are all reasonable guesses, not verified ones.
- **`build.gradle`'s ForgeGradle DSL** (`minecraft { mappings channel: 'official', ... }`, the `runs { client { ... } }` block, the `[6.0,6.2)` plugin version range) - the standard MDK-template shape, but unverified against the actual plugin.
- **Field-vs-getter guesses everywhere a Fabric file used a Yarn getter** - e.g. `options.gamma`/`options.fov` as direct fields (`FullbrightFeature.java`, `FovZoomFeature.java`) instead of Yarn's `getGamma()`/`getFov()`. Official mappings generally expose these as plain fields, but the exact field names are a guess.
- **Movement/action keybinding field names** in `ToggleSprintFeature.java` and `InfoHudFeature.java` (`options.keyUp`, `keyLeft`, `keyDown`, `keyRight`, `keyJump`, `keyAttack`) and the sneak/hunger renames (`isShiftKeyDown()`, `getFoodData()`).
- **`BlockStateCodec.java`** - the same `Property.name()`/`parse()` moderate-confidence spot as Fabric's, plus fresh guesses at `BuiltInRegistries`, `StateDefinition`, `defaultBlockState()`, `setValue()`.
- **`player.displayClientMessage(Component, boolean)`** in `OmegaClientForge.java` - the official-mappings equivalent of Fabric's `sendMessage(Text, boolean)`.
- **`.bounds(x, y, w, h)`** on `Button.Builder` in `ClickGuiScreen.java`/`SchematicScreen.java` - a guess at the official-mappings equivalent of Yarn's convenience `.dimensions(...)` call.
- **`Minecraft.stop()`** in `ClickGuiScreen.java` (account switching) - guessed as the official-mappings equivalent of Yarn's `MinecraftClient.scheduleStop()`; moderate confidence.
- **`ParticleEngineMixin.java` and the MixinGradle wiring in `build.gradle`/`mods.toml`** (particle control) - the first CI compile already corrected this spot once (`createParticle` returns `@Nullable Particle`, not void, and refmap generation via the official MixinGradle plugin replaced a wrong "skip the refmap" guess). If it breaks again, it fails loudly at startup rather than silently misbehaving (the mixin config is `"required": true`).
- **`ParticleEngine#add(Particle)`** in the same file - the raw-Particle spawn path the master particle switch also needs to cover (see "Particle control" above); guessed short name `add`, unverified.

Higher-confidence renames used throughout (less likely to be the problem, but listed for completeness): `MinecraftClient`→`Minecraft`, `World`→`Level`, `Identifier`→`ResourceLocation`, `Text`→`Component`, `DrawContext`→`GuiGraphics`, `MatrixStack`→`PoseStack`, `Vec3d`→`Vec3`, `RenderLayer`→`RenderType`, `VertexConsumerProvider`→`MultiBufferSource`, `NbtCompound`/`NbtList`→`CompoundTag`/`ListTag`.

## Target version

Minecraft 1.20.1. Fabric Loader 0.15.11 / Fabric API 0.92.2+1.20.1 / Yarn 1.20.1+build.10 (fabric module), Forge 47.2.0 (forge module) - see `gradle.properties`. Bump those together to target a different Minecraft version.
