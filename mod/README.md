# Omega Client (companion mod - Fabric + Forge)

*The last client you will ever need.*

A small client mod that adds an in-game toggle menu for visual/QoL PvP settings, built for **both Fabric and Forge**. It's designed to be installed like any other mod through the Omega Client launcher's **Import your mods** button, and its config file (`config/omega-client.json`) is a plain JSON file the launcher's **Configure** button can already edit.

Open the menu in-game with **Right Shift** (rebindable in vanilla's Controls screen, under "Omega Client").

## Project layout

```
mod/
  common/    # SchematicData, SchematicBlockEntry - the ONLY code shared between loaders (see below)
  fabric/    # Fabric build - mod id "omega-client"
  forge/     # Forge build - mod id "omega_client_forge" (Forge disallows hyphens in mod ids)
```

Each loader module has its own full implementation of every feature (ModConfig, FullbrightFeature, the schematic tool, etc.) - **not** a single shared implementation. Here's why: Fabric mods are conventionally written against Yarn mappings (community-maintained names for Minecraft's classes), Forge mods against Mojang's own official mappings - different names for the same underlying game classes. Naively sharing source between a Yarn-mapped module and an officially-mapped one isn't safe without a remapping layer (that's literally what the Architectury Loom toolchain exists to solve). Since this project has no way to test-verify a Gradle setup that complex, the lower-risk choice was two independent, loader-idiomatic implementations, sharing only the two classes with zero Minecraft API surface at all (`SchematicData`, `SchematicBlockEntry` - plain data holders, safe to compile once and use from both). If you want true single-source multi-loader builds later, adopting Architectury for this project is the natural next step.

One practical consequence: **the Forge module has never had any of its class/method name guesses checked against anything** (not even the "this pattern is well-established" confidence the Fabric side earned from being written first) - it carries meaningfully more unverified surface area. See "Building" below for the specific spots to check first.

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

## Building

This mod could not be compiled inside the sandboxed environment that generated it - `maven.fabricmc.net` (Fabric) and `maven.minecraftforge.net` (Forge) are both blocked by that environment's egress policy, and there's no way to launch/test a real Minecraft session there either. Every file passed a `javac` syntax check with no classpath (catches real syntax errors and internal cross-file mistakes, confirmed clean across all three modules), but **none of this has been compiled or run against real Minecraft/Fabric/Forge classes.** Treat it as a solid first draft, not a verified build - true of both loaders, but more so for Forge (see below).

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

Higher-confidence renames used throughout (less likely to be the problem, but listed for completeness): `MinecraftClient`→`Minecraft`, `World`→`Level`, `Identifier`→`ResourceLocation`, `Text`→`Component`, `DrawContext`→`GuiGraphics`, `MatrixStack`→`PoseStack`, `Vec3d`→`Vec3`, `RenderLayer`→`RenderType`, `VertexConsumerProvider`→`MultiBufferSource`, `NbtCompound`/`NbtList`→`CompoundTag`/`ListTag`.

## Target version

Minecraft 1.20.1. Fabric Loader 0.15.11 / Fabric API 0.92.2+1.20.1 / Yarn 1.20.1+build.10 (fabric module), Forge 47.2.0 (forge module) - see `gradle.properties`. Bump those together to target a different Minecraft version.
