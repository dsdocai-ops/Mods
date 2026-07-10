---
name: generate-cosmetic
description: Generate a new Omega Client cosmetic - a colored nametag badge, or gear (hat, cape, wings) rendered on the player - from a reference image and/or a text description. Use when asked to add, create, generate, or design a cosmetic, badge, hat, cape, or wings - e.g. "make a cosmetic from this logo", "add an emerald cape", "generate a hat that matches this screenshot" - including picking its kind and colors, wiring it into the catalog/licensing pipeline, and minting a license key for it.
---

<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->

A cosmetic is one of four kinds (`CosmeticCatalog.Kind`):

- **BADGE** - recolors the Ω prefix on the wearer's nametag (`EntityRendererMixin`).
- **HAT / CAPE / WINGS** - solid-color geometry rendered on the player model
  (`CosmeticFeatureRenderer` on Fabric, `CosmeticRenderLayer` on Forge), with
  shapes defined once in `CosmeticGeometry` (common, pure data).

Every kind is *colored geometry/text*, not textured art: a reference image is a
**palette source** (its colors become the cosmetic's primary/secondary colors),
not a texture that gets wrapped onto a model. If the user expects pixel-art
capes or custom 3D models, say so plainly - that's a texture/model pipeline
that doesn't exist yet. A new cosmetic of an existing kind is a **data-only
change** (catalog entry + id lists); a brand-new *shape* additionally means new
quads in `CosmeticGeometry` (and a new Kind means touching the renderers'
anchor logic too).

All paths below are relative to the repo root (`/home/user/Mods` in this
container).

## The pipeline a cosmetic lives in

`ownedCosmeticId` (written by the launcher's redeem flow into each instance's
`config/omega-client.json`) → broadcast over the `omega-client:presence`
channel with the player's UUID (`PresenceNetworking`, both loaders) →
`OmegaPresence` map on every other Omega client → `CosmeticCatalog.get(id)` →
BADGE kinds recolor the nametag Ω (`colorFor`, gear kinds fall back to default
red there); gear kinds render `CosmeticGeometry.quadsFor(kind)` anchored to the
head (HAT) or body (CAPE/WINGS) model part.

**One cosmetic id lives in THREE hand-synced lists** (grep
`KNOWN_COSMETIC_IDS|COSMETICS` if this list rots):

1. `mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java` -
   the `COSMETICS` map entry: `new Cosmetic(id, Kind, primaryRgb, secondaryRgb)`
   (the only place kind + colors exist; everything else carries just the id)
2. `src/shared/cosmetics.ts` - `KNOWN_COSMETIC_IDS` (what `licensing.ts` will
   redeem)
3. `scripts/generate-license-key.cjs` - its own private `KNOWN_COSMETIC_IDS`
   copy (not shipped, so it can't import the shared one)

The Settings page (`src/renderer/pages/Settings.tsx`) and the licensing/redeem
flow need **no** per-cosmetic changes - they render/validate whatever is in
those lists.

## Workflow

### 1. Pick the kind and derive candidate colors

Kind comes from the user's intent (a "crown" request = HAT, "dragon wings" =
WINGS, a plain color/logo with no shape mentioned = BADGE unless they say
otherwise). Each kind uses two color slots: primary (main surface) and
secondary (hat band / cape lining / wing top ridge; badges ignore secondary -
set it equal to primary).

From image(s) - any format Chromium decodes (png/jpg/webp/gif/bmp/svg/avif):

```bash
node .claude/skills/generate-cosmetic/extract-colors.mjs <image> [<image> ...]
```

Prints per image: `average`, the top-8 `palette` (hex + pixel share + HSL), and
`suggestedBadge` - the most vibrant prominent color, lightness-lifted into the
0.5-0.78 band that stays readable on the nametag plate. For a BADGE, use
`suggestedBadge` (`suggestedBadgeSource` is the pre-lift color; if they differ,
tell the user the art's true color was too dark/light for a nametag). For gear,
the lift doesn't apply - pick primary/secondary straight from `palette`
(typically the top pick and the most contrasting vibrant runner-up), guided by
which part of the art the user says matters.

From a description only: pick the hexes yourself (for badges: HSL lightness
0.5-0.78, real saturation).

### 2. Preview - always, before touching code

**Badge** (nametag readability, translucent plate over three scenes):

```bash
node .claude/skills/generate-cosmetic/preview-badge.mjs <#hex|0xRRGGBB> [...] [--name Steve] [--out file.png]
```

Check: readable in ALL three backdrops, distinct from the `#E63946` default
red and every existing badge.

**Gear** (renders the REAL `CosmeticGeometry` quads on a blocky stand-in
player - it javac-compiles `GeometryDump.java` against the actual mod sources,
so preview and in-game shape cannot drift):

```bash
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --kind hat|cape|wings --primary <#hex> --secondary <#hex> [--out file.png]
```

Colors apply at render time - iterating on a palette needs no code change.
Check: primary/secondary contrast against each other and against Steve-ish
skin/shirt tones. When working interactively, send the user the preview for
approval before wiring anything in.

### 3. Pick the id

`snake_case`, charset `[a-z0-9_]`, kind-suffixed like the existing entries
(`gold_badge`, `crimson_cape`, `seraph_wings`, `obsidian_top_hat`). The
Settings page displays the **raw id** as the owned-cosmetic label, so pick
something a buyer can read. Must be unique across the three lists. No hyphens:
license keys are `<id>-<suffix>` split on the *last* `-` - technically
tolerant of hyphenated ids, but don't create the ambiguity.

### 4. Wire it in

Add the id to all three files from the list above (kind + colors go only in
`CosmeticCatalog.java`, as `0xRRGGBB` - see Gotchas on `Map.of` and alpha).
New shape/kind work happens in `CosmeticGeometry.java` - read its coordinate
contract doc first (model pixels ÷16, y-DOWN, +z = player's back, HAT anchored
to head / CAPE+WINGS to body) and the Gotchas below before authoring quads.
If the cosmetic set stops matching what `README.md`'s "Paid cosmetics" section
and `mod/README.md`'s presence-badge feature row describe, update those
sentences too.

### 5. Verify

```bash
npm run typecheck
javac -d /tmp/javac-check mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java mod/common/src/main/java/com/omega/client/presence/CosmeticGeometry.java
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --kind <kind> --primary <hex> --secondary <hex>   # re-run after any geometry edit; look at the PNG
npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs
node scripts/generate-license-key.cjs <new_id>
```

- `javac` standalone works because `CosmeticCatalog`/`CosmeticGeometry`
  deliberately have zero Minecraft imports. The renderers
  (`mod/fabric/.../render/CosmeticFeatureRenderer.java`,
  `mod/forge/.../render/CosmeticRenderLayer.java`) and the full `mod/` Gradle
  build are **CI-only** (Minecraft Maven deps are network-blocked here, see
  `mod/README.md`) - don't claim the render side is verified locally, only
  that the geometry/catalog compile and the preview shows the shape.
- The smoke test exercises the real `licensing.ts` redeem path against
  `KNOWN_COSMETIC_IDS`.
- The generated key (`<id>-<12 hex chars>`) is the deliverable to hand the
  user - it's what redeems in Settings → Cosmetics. Note it's derived from the
  placeholder `LICENSE_SECRET` (`REPLACE_ME_WITH_YOUR_OWN_SECRET`) unless
  they've replaced it in BOTH `src/main/licensing.ts` and
  `scripts/generate-license-key.cjs`.

## Gotchas

- **`Map.of` caps at 10 entries.** `COSMETICS` uses `java.util.Map.of(...)`,
  which won't compile past 10 pairs. At the 11th cosmetic, switch to
  `Map.ofEntries(Map.entry(...), ...)`. The standalone `javac` step catches this.
- **Java colors are `0xRRGGBB`, no alpha byte.** They feed
  `Style.withColor(int)` and 0-1 vertex color floats; `0xFFRRGGBB` would be a
  wrong (huge) int, not "opaque".
- **Never let two faces from different boxes share a plane** when authoring
  geometry - every face renders double-sided, so coincident planes z-fight
  in-game. Sink one shape *into* the other's volume instead of abutting it
  (see `hat()`'s doc - crown and band bottoms sit inside the brim). Also stay
  clear of the skin overlay layers: hat overlay = head +0.5px (top at y -8.5),
  jacket = body +0.25px.
- **Gear is unlit solid color by design** (debug-quads layer: position+color,
  no texture/light) with per-face shade baked by `CosmeticGeometry`. Cosmetics
  look the same in caves as in daylight - accepted v1 aesthetic, don't "fix"
  it by guessing at lit render layers you can't compile-check. Same for
  animation: none (capes don't sway) - that's a future feature, not a bug.
- **Gear kinds do NOT recolor the nametag** - `colorFor()` returns the default
  red unless the kind is BADGE (a near-black hat primary would be unreadable
  as text). Don't promise a matching badge with gear.
- **The extractor's `average` is usually the wrong answer** for multi-colored
  art (it mixes to mud). Use `palette`/`suggestedBadge`.
- **Judge colors on the previews, not in isolation** - the badge plate is 25%
  black over the world; gear shades every face by 0.5-1.0.
- **`npm install` fails on electron's postinstall in this environment**
  (binary download is network-blocked - same root cause as the Gotchas in
  `.claude/skills/run-omega-client/SKILL.md`). Use
  `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`. Playwright's browser comes
  pre-provisioned at `/opt/pw-browsers`; nothing downloads it.
- **Don't promise server-side exclusivity.** Ownership is self-reported
  client-side by design (see `CosmeticCatalog.java`'s javadoc and README's
  "Known, accepted limitation") - a new cosmetic doesn't change that trust
  model, and copy that claims otherwise would be wrong.
- **New files here start with the Revelation 22:13 header comment** - every
  file in this repo carries it; match the convention.
