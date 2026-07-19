<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->
# Porting the Omega mod to a new Minecraft version

Worked example: **Minecraft 1.21.11** (the first target beyond 1.20.1). Follow the same steps for any later version.

This is the executable checklist for the "injection points" half of the multi-version architecture described in `README.md` → "Multi-version architecture". The core (`common/`) and the `OmegaHooks` seam do **not** change per version; only the thin, mapping-specific injection points do. The launcher side is already version-aware (`src/main/bundledMods.ts`'s `OMEGA_MOD_MINECRAFT_VERSIONS` — add the new version there once a jar for it actually ships).

> **Why this is a checklist and not a finished commit:** the dev sandbox that authored this cannot reach the Fabric/Mojang/Maven hosts (the proxy 403-denies them — same reason the mod only ever builds in CI) and cannot compile the mod, so the two things this port turns on — the exact version coordinates, and whether each obfuscated mixin target still resolves — can only be obtained/verified in an environment with network + Gradle. Everything below is written so that environment can execute it directly.

## Step 0 — Decide the loader story for this version

- **Fabric**: unchanged approach; still Yarn-mapped, still Architectury Loom.
- **Forge vs NeoForge**: for 1.21.x, upstream Forge is largely superseded by **NeoForge**, and several APIs this mod uses on the Forge side (networking especially — see below) were reworked in the 1.20.5+/1.21 cycle. **Confirm a real Forge build exists for 1.21.11 before assuming the `forge/` module ports as-is.** If it doesn't, the `forge/` module becomes a `neoforge/` module (new mod id namespace, `neoforge.mods.toml` instead of `mods.toml`, NeoForge's event bus and `PayloadRegistrar` networking). Treat "Forge → NeoForge" as its own sub-project, not a coordinate bump.

## Step 1 — Real coordinates (fill these in from the source of truth, do not guess)

Obtain the actual current values and drop them into a **per-version overlay** (Step 2), never by editing the shared 1.20.1 values in `mod/gradle.properties`:

| Property | Where to get it | 1.20.1 value (for reference) |
|---|---|---|
| `minecraft_version` | Mojang version manifest (confirm the id exists) | `1.20.1` |
| `yarn_mappings` | `https://meta.fabricmc.net/v2/versions/yarn/<mc>` (take the highest `build`) | `1.20.1+build.10` |
| `loader_version` | `https://meta.fabricmc.net/v2/versions/loader` | `0.15.11` |
| `fabric_version` (Fabric API) | Modrinth project `fabric-api`, filtered to `<mc>` | `0.92.2+1.20.1` |
| `forge_version` | `https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json` (or NeoForge's maven) | `1.20.1-47.2.0` |

## Step 2 — Per-version source-set overlay (the structural change)

The mixins in `fabric/src/main/java/com/omega/client/mixin/` and `forge/src/main/java/com/omega/client/forge/mixin/` are the only files that name obfuscated targets, so they are the only source that goes per-version. Everything else (`common/`, screens, entrypoints, `PresenceNetworking`, renderers) stays shared unless a specific file's target actually changed.

Recommended layout (mirrors how Stonecutter/rich-multiversion Fabric mods do it):

```
mod/
  common/                     # unchanged, shared by every version
  fabric/
    src/main/java/...         # loader glue that is version-stable (entrypoint, screens, renderers)
    src/1.20.1/java/.../mixin # 1.20.1's mixin set  (move today's mixin/ here)
    src/1.21.11/java/.../mixin# 1.21.11's mixin set (ported copies)
  forge|neoforge/ ...         # same split
```

Wire the active overlay into the compiled source set via a Gradle property, e.g. in each loader's `build.gradle`:

```gradle
sourceSets.main.java.srcDir "src/${project.minecraft_version}/java"
```

so CI selects the overlay with `-Pminecraft_version=1.21.11`. **This is the one genuinely fragile Gradle change** (the Loom/Architectury build took seven CI rounds to stabilize originally — see `README.md`). Change it in isolation, confirm 1.20.1 still builds green through the new `src/1.20.1/` path *before* adding the 1.21.11 overlay.

## Step 3 — Re-verify every injection target against the new mappings

These are every mixin target the mod uses. For each, confirm the method still exists under that name/signature in 1.21.11's mappings; if renamed, update the `@Mixin`/`@Inject` target only (the body already just calls `OmegaHooks` and needs no change). Risk = likelihood it changed across 1.20→1.21.

| Feature | Fabric target (Yarn) | Forge target (Mojmap) | Risk 1.20→1.21 |
|---|---|---|---|
| No Hurt Cam | `GameRenderer#tiltViewWhenHurt` | `GameRenderer#bobHurt` | low–med |
| No Fog | `BackgroundRenderer#applyFog` | `FogRenderer#setupFog` | **high** — the fog system was substantially reworked in the 1.21.x cycle; class and/or method may not exist as-is. Expect to re-find the hook. |
| Clear Weather | `World#getRainGradient` / `#getThunderGradient` (+ `isClient`) | `Level#getRainLevel` / `#getThunderLevel` (+ `isClientSide`) | low |
| Particle filter | `ParticleManager#addParticle(ParticleEffect,DDDDDD)` + `addParticle(Particle)` | `ParticleEngine#createParticle(...)` + `add(Particle)` | med |
| Nametag badge | `EntityRenderer#renderLabelIfPresent` | `EntityRenderer#renderNameTag` | **med–high** — the render pipeline (VertexConsumer/render-state plumbing) changed notably in 1.21.2+; the method's parameter list is the likely break even if the name holds. |
| Ω pause button | `GameMenuScreen#initWidgets` | `PauseScreen#init` | low–med |

Non-mixin, mapping-divergent code to re-verify by compile (no `OmegaHooks` seam — these touch Minecraft types directly): `WireBoxRenderer`, `SolidBoxRenderer`, the render-context parts of `BlockHighlightFeature`/`SchematicRenderFeature`, `CosmeticRenderer`, every `*Screen`, and **`PresenceNetworking`** (Fabric's networking API was overhauled in 1.20.5+/1.21 — `CustomPayload`/`PayloadTypeRegistry`; the Forge/NeoForge side likewise. Budget real time here.)

## Step 4 — CI build matrix

In `.github/workflows/build.yml`, turn the single `mod-jars` job into a matrix over supported versions, passing each as `-P` overrides so no shared file is edited:

```yaml
strategy:
  matrix:
    mc: ["1.20.1", "1.21.11"]
steps:
  - run: ./gradlew :fabric:build :forge:build -Pminecraft_version=${{ matrix.mc }} -Pyarn_mappings=... (etc.)
```

Emit **version-tagged jars** (`omega-client-fabric-<mc>.jar`) so versions don't collide, and update the three consumers in lockstep: the artifact upload globs, the launcher's `findBundledJar` (match `omega-client-<loader>-<mc>`), and `omegaJarFor` (fetch/select by the instance's resolved MC version). Add `1.21.11` to `OMEGA_MOD_MINECRAFT_VERSIONS` **only after** its jar is actually published, or a matching instance gets handed a nonexistent jar.

## Step 5 — Verify

There is no local compile in the authoring sandbox; CI is the verification. Land Step 2 (overlay, 1.20.1 only) green first, then the 1.21.11 overlay + coordinates, then the matrix. Expect several CI rounds on Step 3's mapping names — that iteration is inherent to porting blind and is exactly why the mixin bodies were reduced to `OmegaHooks` calls first, so each round only ever adjusts a target coordinate, never logic.
