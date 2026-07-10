---
name: generate-cosmetic
description: Generate a new Omega Client cosmetic - a colored nametag badge, or pixel-art gear (hat, cape, wings) rendered on the player like an extruded Minecraft item texture, with capes/wings animated by a real sway/flap system and an optional colored particle trail - from a reference image and/or a text description. Use when asked to add, create, generate, or design a cosmetic, badge, hat, cape, or wings, to make one animated/swaying/flapping, or to give one a particle trail/sparkle effect - e.g. "make a cosmetic from this logo", "add an emerald cape", "generate a hat that matches this screenshot", "make the wings flap", "give the cape a sparkle trail" - including authoring the pixel art, wiring it into the catalog/licensing pipeline, previewing its animation, and minting a license key for it.
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

**CAPE and WINGS animate** - a stylized procedural sway/flap, computed fresh
every frame by `CosmeticAnimation` (common, pure) and applied by both
renderers, not baked into the geometry. HAT and BADGE are rigid by design
(nothing should swing loose off someone's head) - see "The animation model"
below.

**CAPE and WINGS can also opt into a colored particle trail** from their tip
(the cape's hem, each wingtip) - an *authoring choice* per cosmetic
(`trailColor`, nullable), not automatic for every CAPE/WINGS. See "The
particle trail model" below.

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
   the `COSMETICS` map entry: `new Cosmetic(id, Kind, badgeRgb, art, trailColor)`
   where `art` is a `CosmeticPixelArt` constant (null for badges; badgeRgb is
   only read for badges - pass `DEFAULT_BADGE_RGB` for gear) and `trailColor`
   is a nullable boxed `Integer` RGB (null = no particle trail; only ever fires
   for CAPE/WINGS - see "The particle trail model")
2. `src/shared/cosmetics.ts` - `KNOWN_COSMETIC_IDS` (what `licensing.ts` will
   redeem)
3. `scripts/generate-license-key.cjs` - its own private `KNOWN_COSMETIC_IDS`
   copy (not shipped, so it can't import the shared one)

Gear art itself lives as a text block in
`mod/common/.../presence/CosmeticPixelArt.java`.

The Settings page (`src/renderer/pages/Settings.tsx`) and the licensing/redeem
flow need **no** per-cosmetic changes.

## The animation model

`CosmeticGeometry.Quad` carries two extra fields alongside each vertex's
position/color/shade: `pivot` (the point this quad hinges around - the collar
midpoint for CAPE, the shoulder attachment for WINGS) and `depth01` (0 at that
pivot, rising to 1 at the free edge - the cape's hem, a wingtip). Both are
computed once, at geometry-build time, from the pixel grid itself: CAPE's
depth01 is the art row's position (`y / (height-1)`), WINGS' is the art
column's position (`x / (width-1)`) - so a cosmetic's OWN art shape decides
how it hinges, nothing kind-specific to hand-tune per cosmetic.

`CosmeticAnimation.animate(quad, kind, ageTicks, motion)` (common, pure, zero
Minecraft imports) is called **fresh every frame, per vertex**, by both
renderers - never baked into `CosmeticGeometry`'s cached quad list, since that
cache is shared by every wearer while animation is per-player and time-
varying. It rotates each vertex around its `pivot` by an angle scaled by
`depth01` (so the pivot edge stays rigid and the free edge swings most),
composed from:

- an idle sway/flap, always present, driven by `sin(ageTicks * freq)`
- a motion-driven lean/flap-rate increase, fading in with `motion` (a forward
  cape lean, a faster/wider wingbeat)

Both inputs are **already-available vanilla parameters** on the
`FeatureRenderer`/`RenderLayer` `render()` methods both classes override -
`ageTicks` is Fabric's `animationProgress` / Forge's `ageInTicks` (entity age
+ partial tick, monotonic); `motion` is Fabric's `limbDistance` / Forge's
`limbSwingAmount` (vanilla's own limb-swing-amount, ~0 standing still, >1
sprinting, clamped to [0,1] here) clamped in `CosmeticAnimation`. No new
plumbing, and deliberately no player-velocity access (a real Fabric/Forge
mapping-divergence risk this class sidesteps entirely).

HAT and BADGE never move: `CosmeticGeometry`'s HAT frame always supplies
depth01=0 (see `CosmeticGeometry.build`'s `HAT` case), and `animate()` no-ops
for any kind that isn't CAPE/WINGS regardless. This is a deliberate choice, not
a gap - nothing about a hat should look like it's coming loose. A hat that
*should* visibly move (a spinning halo-topper, an antenna that wobbles) is a
new `Kind` and a new frame, not an extension of HAT's existing rigidity.

This is a **stylized rotation, not physics or cloth simulation**: no wind, no
collision, no per-cosmetic amplitude/frequency tuning knobs (every CAPE shares
one motion profile, every WINGS shares another - see the constants at the top
of `CosmeticAnimation`'s CAPE/WINGS branches). Proportionate to a vanity
cosmetic, consistent with the flat baked shading `CosmeticGeometry` already
uses instead of real lighting.

## The particle trail model

`CosmeticGeometry.tipPointsFor(cosmetic)` returns the free tip(s) of a CAPE
(one: the hem center) or WINGS (two: each wingtip) as `TipPoint`s - the same
`pivot` a mesh Quad there would carry, at `depth01` 1.0. Both renderers, for
any cosmetic with a non-null `trailColor`, animate each tip point through
`CosmeticAnimation.animatePoint(...)` (the exact same rotation `animate()`
applies to mesh vertices - the trail swings in lockstep with the visible hem/
wingtip, not a separately-approximated point), convert it to a world position
via `CosmeticTrail.toWorld(...)` (pure trig - see that class's doc for the
full derivation and its known approximation: head yaw stands in for body yaw,
close enough for a decorative effect), roll a chance to skip most frames
(`CosmeticTrail.shouldEmit`, ~6/sec per tip), and spawn one colored dust
particle (`DustParticleEffect` on Fabric, `DustParticleOptions` on Forge -
both take an RGB `Vector3f` + a scale) tinted to `trailColor`.

**This is the least locally-verifiable part of the whole cosmetic pipeline.**
`CosmeticTrail`'s coordinate math is pure/common and was numerically sanity-
checked (a standalone script confirmed the tip lands "behind" the wearer at
all four cardinal yaws, and the derived height roughly matched what the mesh
previews already showed) - trust that part. The actual particle-spawning
calls in `CosmeticFeatureRenderer.spawnTrail` / `CosmeticRenderLayer.spawnTrail`
touch Minecraft particle APIs (`DustParticleEffect`/`DustParticleOptions`,
`ClientWorld`/`ClientLevel#addParticle`) used nowhere else in this codebase -
CI-only verified, genuinely lower confidence than the mesh rendering next to
it (which at least reuses patterns already proven correct by the earlier
screenshots). Flag this plainly if asked about trail reliability; don't claim
it's been seen working in-game.

Giving a cosmetic a trail is a **one-line, purely additive change**: set
`trailColor` on its `COSMETICS` entry (or leave it `null` - not every cosmetic
needs one; a plain-colored cape might not want a sparkle). No preview support
for trails exists yet (`preview-cosmetic.mjs` doesn't render particles) -
that's a known gap, not an oversight; the shape/animation previews still cover
everything else about the cosmetic.

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

**For CAPE/WINGS, also check the animation** - add `--animate` to either form
above (works on both a candidate art file and a catalog id):

```bash
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --art art.txt --kind cape --animate
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --id seraph_wings --animate
```

Renders a filmstrip through the REAL `CosmeticAnimation` (not a guess at what
the sway looks like): two rows (standing still, full sprint) x six moments in
time, back-¾ view. Check: the standing-still row shows a gentle, subtle sway
(idle motion is intentionally understated); the full-sprint row shows a
clearly bigger swing/flap; nothing clips through the player's body at the
widest angle; a wing's flap or a cape's lean looks smooth across the six
frames, not like it's teleporting between wildly different poses (if it does,
the art's silhouette is probably too tall/wide for its kind's canonical grid -
see "The animation model" above on how depth01 is derived from the art
itself). Running `--animate` on a HAT or BADGE is pointless (see above) - use
it only for CAPE/WINGS.

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
- Badge: catalog entry with the color as `badgeRgb`, art `null`, trailColor `null`.
- Optional, CAPE/WINGS only: set `trailColor` to an `0xRRGGBB` int (usually one
  of the art's own palette colors) to give it a particle trail; `null` for none.
- Add the id to the other two lists (`cosmetics.ts`, `generate-license-key.cjs`).
- If the cosmetic set stops matching what `README.md`'s "Paid cosmetics"
  section and `mod/README.md`'s presence-badge feature row describe, update
  those sentences too.

### 5. Verify

```bash
npm run typecheck
javac -d /tmp/javac-check mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java mod/common/src/main/java/com/omega/client/presence/CosmeticGeometry.java mod/common/src/main/java/com/omega/client/presence/CosmeticPixelArt.java mod/common/src/main/java/com/omega/client/presence/CosmeticAnimation.java mod/common/src/main/java/com/omega/client/presence/CosmeticTrail.java
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --id <new_id>   # now from the catalog; look at the PNG
node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --id <new_id> --animate   # CAPE/WINGS only; look at the filmstrip
npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs
node scripts/generate-license-key.cjs <new_id>
```

- `javac` standalone works because all five cosmetic classes deliberately
  have zero Minecraft imports - it also executes `parse()` on every art block
  via the preview step, so a bad grid fails here. The renderers
  (`mod/fabric/.../render/CosmeticFeatureRenderer.java`,
  `mod/forge/.../render/CosmeticRenderLayer.java`) and the full `mod/` Gradle
  build are **CI-only** (Minecraft Maven deps are network-blocked here, see
  `mod/README.md`) - don't claim the render side is verified locally, only
  that catalog/art/extrusion/animation/trail-math compile and the preview
  shows the shape/motion. The `--animate` preview is the closest local check
  the mesh-animation renderer wiring gets: it runs the exact same
  `CosmeticAnimation.animate()` call both renderers make, just fed by
  `GeometryDump` instead of a real `FeatureRenderer`/`RenderLayer` frame. The
  particle-trail spawn calls have **no equivalent local check** - see "The
  particle trail model" above.
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
  guessing at lit render layers you can't compile-check.
- **Gear kinds do NOT recolor the nametag** - `colorFor()` returns the default
  red unless the kind is BADGE. Don't promise a matching badge with gear.
- **Animation amplitude is a function of the ART's shape, not a dial you turn
  per cosmetic.** depth01 comes from the pixel grid's own row/column position
  (see "The animation model"), so a CAPE authored unusually short (fewer rows)
  or a WINGS authored unusually narrow (fewer columns) will sway/flap over a
  smaller fraction of its own length than a canonical-sized one - not because
  anything is misconfigured, just because there are fewer "far from the pivot"
  rows/columns to begin with. If a cosmetic needs a bigger or smaller swing
  than its siblings, that's a `CosmeticAnimation` constant change (affects
  every CAPE or every WINGS alike - there's no per-cosmetic override), not
  something to fix by re-authoring the art.
- **Don't add player-velocity access, wind, or per-cosmetic animation
  parameters without re-reading `CosmeticAnimation`'s class doc first.** It
  deliberately only reads `ageTicks`/`motion` (parameters both renderers
  already receive) specifically to avoid touching loader-mapping-divergent
  APIs (`getVelocity()` vs `getDeltaMovement()`) that can't be compile-checked
  here. A "make it react to actual velocity" request is a real scope increase,
  not a small tweak - flag the mapping risk before making it.
- **A new animated `Kind` (e.g., a spinning halo-hat) needs three things**,
  not just new geometry: (1) a `DepthFn`+pivot in `CosmeticGeometry.build`
  that isn't the current always-zero HAT case, (2) a branch in
  `CosmeticAnimation.animate`'s kind switch, (3) confirming the anchor
  ModelPart (head vs body) still makes sense for how it should move. Skipping
  any one leaves it silently rigid.
- **Setting `trailColor` on a HAT or BADGE does nothing** (silently - no
  error, no warning). `CosmeticGeometry.tipPointsFor` only returns points for
  CAPE/WINGS, so the trail loop in both renderers just never runs. Leave it
  `null` for those kinds - a non-null value there is misleading dead data.
- **A new trailed cosmetic needing a NEW tip point** (a third kind, or a
  cosmetic whose "trailing edge" isn't its geometric hem/wingtip) means adding
  a case to `CosmeticGeometry.tipPointsFor`, mirroring the ORIGIN/U/V it
  already uses in `build()`'s matching case - keep the two in sync by hand
  (there's no shared frame object between them; see that method's own doc for
  why). A tip point that doesn't match its mesh's actual frame will animate
  correctly in isolation but drift from where the visible hem/wingtip actually
  is.
- **Don't extend `CosmeticTrail` to read player velocity, body yaw, or the
  render MatrixStack/PoseStack** without re-reading its class doc first - it
  deliberately sticks to `getX/Y/Z()` + head yaw (both loaders' already-passed
  parameters) specifically to avoid new mapping-divergent API surface. Camera-
  relative-vs-world-space MatrixStack extraction in particular is a real trap
  documented there - don't reach for `matrices.peek().getPositionMatrix()` to
  "get the exact position," it needs a camera-position offset this codebase
  doesn't otherwise plumb.
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
