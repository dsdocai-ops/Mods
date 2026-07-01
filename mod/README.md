# Omega Client (companion Fabric mod)

*The last client you will ever need.*

A small Fabric client mod that adds an in-game toggle menu for visual/QoL PvP settings. It's designed to be installed like any other mod through the Omega Client launcher's **Import your mods** button, and its config file (`config/omega-client.json`) is a plain JSON file the launcher's **Configure** button can already edit.

Open the menu in-game with **Right Shift** (rebindable in vanilla's Controls screen, under "Omega Client").

## What it does - and deliberately doesn't

Every feature here is a visual or convenience setting, nothing that reads information the player couldn't already get, and nothing that automates input:

| Feature | What it actually does |
|---|---|
| **Fullbright** | Raises `GameOptions.gamma` past vanilla's UI-enforced 0-1 slider range. Purely a brightness override, same technique used by countless QoL Fabric mods. |
| **Block Highlight** | Draws a wireframe outline around configured block types (defaults: obsidian, respawn anchor, crying obsidian) within 20 blocks. Rendered with `RenderLayer.getLines()`, the same depth-tested layer vanilla's own F3+B hitbox debug view uses - **terrain still occludes it**. This is "combat clarity" (see anchors/crystals you're already looking near more easily), not X-ray: it will never show a block through a solid wall. |
| **Custom FOV / Zoom** | Same no-mixin technique as fullbright, applied to `GameOptions.fov`. Zoom is hold-to-zoom via a keybind (default **C**). |
| **Toggle Sprint** | Keeps you sprinting while holding forward, so you don't need double-tap or a sprint-lock keybind from another mod. Doesn't change movement speed or add anything beyond vanilla sprinting. |
| **Info HUD** | Coordinates, FPS, and a WASD+space+click keystroke display. All of this is already visible via vanilla's F3 debug screen - this is just an always-on, friendlier subset of it. |
| **Schematics** | A WorldEdit-style two-point selection, save-to-file, and ghost-preview tool - see below. |

**Intentionally not included**, because they cross from "visual setting" into "unfair advantage against other players" and most servers treat them as cheating: reach/hitbox expansion, aimbot/kill-aura, auto-clicking, velocity or knockback modification, X-ray (seeing blocks *through* terrain), and anything that reads server-side information the client wouldn't normally have.

Using visual settings like fullbright on a server that specifically disallows them can still get you moderated - check the rules of wherever you're playing.

## Default keybinds

All rebindable in vanilla's Controls screen under "Omega Client". `Toggle Preview` and `Re-anchor to Me` ship unbound by default (`Schematics...` in the menu covers both) so they don't collide with anything without you choosing them yourself.

| Action | Default key |
|---|---|
| Open menu | Right Shift |
| Zoom (hold) | C |
| Schematic: set Position 1 | O |
| Schematic: set Position 2 | P |
| Schematic: toggle preview | *unbound* |
| Schematic: re-anchor to me | *unbound* |

## Schematics

A small WorldEdit/Litematica-style building tool: select a region, save it, then load it back later as a ghost-preview overlay to build against.

1. Look at one corner block and press **O** (Position 1), then the opposite corner and press **P** (Position 2). Both get an action-bar confirmation.
2. Open the menu (**Right Shift**) → **Schematics...**, type a name, and hit **Save Selection**.
3. To build from it later: open **Schematics...**, click the saved name to load and start previewing it, stand where you want its corner to land, and click **Re-anchor to Me**.

**This is not the real Litematica `.litematic` file format.** That format is a proprietary, undocumented binary NBT layout (bit-packed per-block-state arrays, sub-region support, etc.), and this project has no way to verify byte-for-byte compatibility with it without a real game session to test against - getting it subtly wrong would produce files that silently don't work in actual Litematica. Instead, Omega Client has its own format ("Omega Schematic", `.omschem.json` - plain, human-readable JSON via Gson) that does the same *job* (capture a region, preview it as a ghost overlay before building) without claiming compatibility it can't back up. Files live in `<config>/omega-client/schematics/`.

Two more scope notes, both deliberate tradeoffs given the constraints above:
- **Only the block type is stored, not orientation/state** (stairs, waterlogged, etc. all lose that detail) - capturing and correctly round-tripping full block-state properties needed either a much riskier custom serializer or a real test session to validate, and this project has neither available. You still get the right block in the right place, just not necessarily facing the right way.
- **The ghost preview is color-coded wireframe outlines, not real block textures.** Textured rendering exists in the Minecraft client (`BlockRenderManager`) but calling it correctly is another spot this project can't compile-verify, so the preview reuses the same depth-tested wireframe technique as Block Highlight instead (each block type gets a consistent deterministic color, so different materials are still distinguishable) - see `SchematicRenderFeature.java`.

## Building

This mod could not be compiled inside the sandboxed environment that generated it - **maven.fabricmc.net** (needed for the Fabric Loom Gradle plugin, Yarn mappings, and Fabric API) is blocked by that environment's egress policy, and there's no way to launch/test a real Minecraft session there either. The source follows standard Fabric API patterns (no Mixins - everything goes through public `GameOptions`, `WorldRenderEvents`, `HudRenderCallback`, and `KeyBindingHelper` APIs), and a `javac` pass with no classpath confirms there are no syntax errors, but **it has not been compiled or run against real Minecraft/Fabric classes.** Treat it as a solid first draft, not a verified build.

To actually build it:

```bash
cd mod
gradle build     # or: ./gradlew build, if you generate the wrapper first (see below)
```

The resulting jar lands in `mod/build/libs/omega-client-0.1.0.jar` - import it into any instance through the launcher's **Import your mods** button like any other mod.

Requirements:
- JDK 17+
- Network access to `maven.fabricmc.net` and Mojang's piston-meta (Loom downloads and remaps the Minecraft jar on first build)
- No Gradle wrapper is checked in (the sandbox that generated this project couldn't validate the wrapper's distribution URL through its proxy). If you don't have Gradle installed, run `gradle wrapper --gradle-version 8.7` once with a local Gradle install, or just open the project in IntelliJ IDEA with the Minecraft Development plugin, which sets one up automatically.

If something doesn't compile against the pinned `yarn_mappings` in `gradle.properties`, check these spots first - everything else in the mod sticks to APIs I have high confidence in, these are the exceptions:
- `GameOptions.getGamma()` / `getFov()` in `FullbrightFeature.java` / `FovZoomFeature.java` - Yarn's exact accessor names for these two fields are moderate- rather than high-confidence.
- `ClientPlayerEntity.sendMessage(Text, boolean)` in `OmegaClient.java` (the action-bar confirmation when setting a schematic position) - the two-arg overload and its boolean meaning (action bar vs. chat) is moderate-confidence.

Your IDE's autocomplete on `client.options.` / `player.sendMessage(` will show the real signatures for your exact `yarn_mappings` build if any of these have drifted.

## Target version

Minecraft 1.20.1 / Fabric Loader 0.15.11 / Fabric API 0.92.2+1.20.1 (see `gradle.properties`). Bump those together to target a different Minecraft version - the feature set doesn't depend on version-specific internals, so it should port cleanly.
