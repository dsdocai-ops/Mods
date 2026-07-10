---
name: generate-cosmetic
description: Generate a new Omega Client cosmetic - a colored nametag badge, or pixel-art gear (hat, cape, wings) rendered on the player like an extruded Minecraft item texture - from a reference image and/or a text description. Use when asked to add, create, generate, or design a cosmetic, badge, hat, cape, or wings - e.g. "make a cosmetic from this logo", "add an emerald cape", "generate a hat that matches this screenshot" - including authoring the pixel art, wiring it into the catalog/licensing pipeline, and minting a license key for it.
---

<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->

A cosmetic is one of four kinds (`CosmeticCatalog.Kind`):

- **BADGE** - recolors the Ω prefix on the wearer's nametag (`EntityRendererMixin`).
- **HAT / CAPE / WINGS** - **pixel art**, exactly like a Minecraft item texture:
  a small grid where each opaque pixel becomes an extruded colored cell in 3D
  (the way vanilla renders held/dropped items) and transparent pixels cut the
  silhouette. Art lives in `CosmeticPixelArt` (common), gets extruded by
  `CosmeticGeometry`, and is drawn by `CosmeticFeatureRenderer` (Fabric) /
  `CosmeticRenderLayer` (Forge).

The art's palette IS the cosmetic's colors - there are no separate color
fields for gear. A new cosmetic of an existing kind is a **data-only change**
(art text block + catalog entry + id lists). What still doesn't exist: skin-
texture-mapped models (a cape that wraps a PNG around curved geometry) - pixel
cells are flat-extruded, which is the intended item-like aesthetic.

All paths below are relative to the repo root (`/home/user/Mods` in this
container).

## The pipeline a cosmetic lives in

`ownedCosmeticId` (written by the launcher's redeem flow into each instance's
`config/omega-client.json`) → broadcast over the `omega-client:presence`
channel with the player's UUID (`PresenceNetworking`, both loaders) →
`OmegaPresence` map on every other Omega client → `CosmeticCatalog.get(id)` →
BADGE kinds recolor the nametag Ω (`colorFor`; gear keeps the default red
there); gear kinds render `CosmeticGeometry.quadsFor(cosmetic)` - the
cosmetic's pixel art extruded into per-pixel quads - anchored to the head
(HAT) or body (CAPE/WINGS) model part.

**One cosmetic id lives in THREE hand-synced lists** (grep
`KNOWN_COSMETIC_IDS|COSMETICS` if this list rots):

1. `mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java` -
   the `COSMETICS` map entry: `new Cosmetic(id, Kind, badgeRgb, art)` where
   `art` is a `CosmeticPixelArt` constant (null for badges; badgeRgb is only
   read for badges - pass `DEFAULT_BADGE_RGB` for gear)
2. `src/shared/cosmetics.ts` - `KNOWN_COSMETIC_IDS` (what `licensing.ts` will
   redeem)
3. `scripts/generate-license-key.cjs` - its own private `KNOWN_COSMETIC_IDS`
   copy (not shipped, so it can't import the shared one)

Gear art itself lives as a text block in
`mod/common/.../presence/CosmeticPixelArt.java`.

The Settings page (`src/renderer/pages/Settings.tsx`) and the licensing/redeem
flow need **no** per-cosmetic changes.

## The pixel art format

Parsed by `CosmeticPixelArt.parse` (same parser at runtime, in the preview, and
for candidate files - a malformed grid throws at parse time, never mid-render):

```
c=C62839          <- palette line: single-char key = RRGGBB (no alpha byte)
g=FFD700
cccggggccc        <- pixel rows; '.' = transparent; all rows same length
cc.gggg.cc
```

Canonical grids (the 3D frames art is stretched into - other sizes work but
stray far and pixels go non-square): **HAT 14x9** (front silhouette, extruded
through the full head depth, resting just above the hat overlay), **CAPE
10x16** (hung from the shoulders, ~15° back tilt, 0.6px thin), **WINGS 12x10**
(right wing on a swept-back parallelogram; the mod mirrors the left wing).
Transparency is load-bearing: it's how a cape gets a fringed hem, wings get
feather gaps, a hat gets its silhouette.

## Workflow

### 1. Pick the kind, get candidate art

Kind comes from the user's intent ("crown"/"beanie" = HAT, "banner on my back"
= CAPE, "dragon wings" = WINGS, plain color/logo with no shape = BADGE unless
they say otherwise).

**From an image** - any format Chromium decodes (png/jpg/webp/gif/bmp/svg/avif):

```bash
node .claude/skills/generate-cosmetic/pixelate.mjs <image> --kind hat|cape|wings [--colors N] [--out art.txt]
```

Downsamples onto the kind's grid (dominant color per cell; a cell under 40%
opaque goes transparent, so image alpha cuts the silhouette), quantizes to ≤N
colors (default 6), and prints both the raw art text and a ready-to-paste Java
text block. **Treat the output as a first draft** - open the rows and hand-tune
like actual pixel art: straighten ragged edges, re-add a detail the
downsample smeared, cut a silhouette with '.'s. For badge color derivation
from an image, `extract-colors.mjs` still does that (see step 1-badge below).

**From a description** - author the rows yourself, in the format above. Real
pixel-art moves: outline/shadow column on one side (see `CRIMSON_CAPE`'s `d`
columns), 1px accent trim, transparency for scallops and fringes, an emblem in
a contrasting color. Keep palettes small (3-5 colors read best at this size).

**Badges**: `extract-colors.mjs <image>` prints a palette + `suggestedBadge`
(lightness-lifted for nametag readability); from a description pick a hex with
HSL lightness 0.5-0.78 and real saturation.

### 2. Preview - always, before touching Java

**Gear** - renders through the REAL parser and extruder (it javac-compiles the
actual mod sources), so what you see is what ships:

```bash
# candidate art file, before it's wired in:
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --art art.txt --kind cape
# or something already in the catalog:
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --id crimson_cape
```

Look at the PNG: silhouette reads at a glance from all three views, colors
contrast against Steve-ish skin/shirt tones, details survived the pixel size.
Iterate on the art file and re-preview - it's cheap.

**Badge**:

```bash
node .claude/skills/generate-cosmetic/preview-badge.mjs <#hex> [...] [--name Steve]
```

Readable in ALL three backdrops, distinct from the `#E63946` default red and
every existing badge.

When working interactively, send the user the preview for approval before
wiring anything in.

### 3. Pick the id

`snake_case`, charset `[a-z0-9_]`, kind-suffixed like the existing entries
(`gold_badge`, `crimson_cape`, `seraph_wings`, `obsidian_top_hat`). The
Settings page displays the **raw id** as the owned-cosmetic label, so pick
something a buyer can read. Must be unique across the three lists. No hyphens:
license keys are `<id>-<suffix>` split on the *last* `-` - technically
tolerant of hyphenated ids, but don't create the ambiguity.

### 4. Wire it in

- Gear: paste the art as a `public static final PixelArt <NAME> = parse("""...""")`
  constant in `CosmeticPixelArt.java` (pixelate.mjs prints this block), then
  reference it from the new `COSMETICS` entry in `CosmeticCatalog.java`.
- Badge: catalog entry with the color as `badgeRgb`, art `null`.
- Add the id to the other two lists (`cosmetics.ts`, `generate-license-key.cjs`).
- If the cosmetic set stops matching what `README.md`'s "Paid cosmetics"
  section and `mod/README.md`'s presence-badge feature row describe, update
  those sentences too.

### 5. Verify

```bash
npm run typecheck
javac -d /tmp/javac-check mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java mod/common/src/main/java/com/omega/client/presence/CosmeticGeometry.java mod/common/src/main/java/com/omega/client/presence/CosmeticPixelArt.java
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --id <new_id>   # now from the catalog; look at the PNG
npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs
node scripts/generate-license-key.cjs <new_id>
```

- `javac` standalone works because the three cosmetic classes deliberately
  have zero Minecraft imports - it also executes `parse()` on every art block
  via the preview step, so a bad grid fails here. The renderers
  (`mod/fabric/.../render/CosmeticFeatureRenderer.java`,
  `mod/forge/.../render/CosmeticRenderLayer.java`) and the full `mod/` Gradle
  build are **CI-only** (Minecraft Maven deps are network-blocked here, see
  `mod/README.md`) - don't claim the render side is verified locally, only
  that catalog/art/extrusion compile and the preview shows the shape.
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
- **Palette colors are `RRGGBB` hex, no alpha.** Transparency is only the `.`
  pixel - a palette entry can't be translucent (position-color rendering is
  opaque; translucent cells would also break the coplanar-face guarantees).
- **Don't hand-author quads.** The extruder handles interior-face removal and
  the no-coplanar-faces rule (every face renders double-sided, so coincident
  planes z-fight); geometry bugs live in art or frames, not in vertex code you
  should write. New *kinds* mean a new frame in `CosmeticGeometry.build` (and
  an anchor decision in both renderers) - keep frames clear of the skin
  overlay layers (hat overlay = head +0.5px, top at y -8.5; jacket = body
  +0.25px).
- **Gear is unlit solid color by design** (debug-quads layer: position+color,
  no texture/light) with per-face shade baked by the extruder. Cosmetics look
  the same in caves as in daylight - accepted aesthetic, don't "fix" it by
  guessing at lit render layers you can't compile-check. Same for animation:
  none (capes don't sway) - future feature, not a bug.
- **Gear kinds do NOT recolor the nametag** - `colorFor()` returns the default
  red unless the kind is BADGE. Don't promise a matching badge with gear.
- **pixelate.mjs output is a draft, not a deliverable.** Machine downsampling
  smears diagonals and drops thin details; the difference between "generated"
  and "good" is a few minutes of hand-editing rows. Also mind quad counts:
  every opaque pixel costs geometry (runs merge, but ~16x16 of noise is
  heavier than clean flat-color art) - keep grids near canonical size and
  palettes small.
- **Judge art in the preview, not in the text rows** - the cape tilts, wings
  are a sheared parallelogram, and the hat is extruded 9px deep; art that
  looks right as text can read differently in 3D.
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
