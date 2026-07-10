---
name: generate-cosmetic
description: Generate a new Omega Client cosmetic (nametag badge) from a reference image and/or a text description. Use when asked to add, create, generate, or design a cosmetic, badge, or badge color - e.g. "make a cosmetic from this logo", "add an emerald badge", "generate a cosmetic that matches this screenshot" - including picking its color, wiring it into the catalog/licensing pipeline, and minting a license key for it.
---

<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->

A "cosmetic" in this codebase today is **a colored Ω badge on the in-game
nametag** - one id mapped to one RGB int. There is no texture/cape/model
pipeline: a reference image is a *palette source* (its colors become the badge
color), not something that gets rendered in-game. If the user expects an
image-textured cosmetic (cape, hat, custom glyph art), say so plainly before
starting - that's a new rendering feature, not this skill.

All paths below are relative to the repo root (`/home/user/Mods` in this
container).

## The pipeline a cosmetic lives in

`ownedCosmeticId` (written by the launcher's redeem flow into each instance's
`config/omega-client.json`) → broadcast over the `omega-client:presence`
channel with the player's UUID (`PresenceNetworking`, both loaders) →
`OmegaPresence` map on every other Omega client → `CosmeticCatalog.colorFor(id)`
→ `EntityRendererMixin` draws `Ω ` in that color before the player's name.
Unknown/empty ids fall back to the default red `0xE63946`.

**One cosmetic id lives in THREE hand-synced lists** (the mirror convention is
documented in each file - grep `KNOWN_COSMETIC_IDS|BADGE_COLORS` to find them
all if this list rots):

1. `mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java` -
   `BADGE_COLORS` map entry `"<id>", 0xRRGGBB` (the only place the color exists;
   everything else carries just the id)
2. `src/shared/cosmetics.ts` - `KNOWN_COSMETIC_IDS` (what `licensing.ts` will
   redeem)
3. `scripts/generate-license-key.cjs` - its own private `KNOWN_COSMETIC_IDS`
   copy (not shipped, so it can't import the shared one)

The Settings page (`src/renderer/pages/Settings.tsx`) and the licensing/redeem
flow need **no** per-cosmetic changes - they render/validate whatever is in
those lists.

## Workflow

### 1. Derive candidate colors

From image(s) - any format Chromium decodes (png/jpg/webp/gif/bmp/svg/avif):

```bash
node .claude/skills/generate-cosmetic/extract-colors.mjs <image> [<image> ...]
```

Prints per image: `average`, the top-8 `palette` (hex + pixel share + HSL), and
`suggestedBadge` - the most vibrant prominent color, lightness-lifted into the
0.5-0.78 band that stays readable on the nametag plate. `suggestedBadgeSource`
is the same color before the lift; if they differ, the art's true color was too
dark/light to read in-game and the lift is doing real work - mention that
trade-off to the user. The suggestion is a starting point: for art where the
*background* is the identity (or the user described which part matters), pick
from `palette` yourself.

From a description only: pick the hex yourself, aiming for HSL lightness
0.5-0.78 and enough saturation to not read as gray on the translucent plate.

### 2. Preview in fake-game context - always, before touching code

```bash
node .claude/skills/generate-cosmetic/preview-badge.mjs <#hex|0xRRGGBB> [...] [--name Steve] [--out file.png]
```

Renders each candidate as the actual in-game composition (colored `Ω ` +
white name on vanilla's `rgba(0,0,0,0.25)` plate) against day/dusk/cave
backdrops, with the current default red as row one for comparison. Screenshot
path is printed (default `/tmp/shots/badge-preview.png`). Look at it yourself
and check: readable in ALL three scenes (the plate is translucent - mid-blues
melt into day sky, dark purples melt into caves), and distinguishable at a
glance from `0xE63946` default red **and** every color already in
`BADGE_COLORS`. When working interactively, send the user the preview for
approval before wiring anything in.

### 3. Pick the id

`snake_case`, charset `[a-z0-9_]`, ending `_badge` (matches `gold_badge`,
`azure_badge`). The Settings page currently displays the **raw id** as the
owned-cosmetic label, so pick something a buyer can read (`emerald_badge`, not
`grn01`). Must be unique across the three lists. No hyphens: license keys are
`<id>-<suffix>` split on the *last* `-`, which technically tolerates hyphenated
ids, but don't create the ambiguity.

### 4. Wire it in

Add the id to all three files from the list above (color goes only in
`CosmeticCatalog.java`, as `0xRRGGBB` - see Gotchas on `Map.of` and alpha).
If the cosmetic set stops being "two placeholders", also update the sentence
in `README.md`'s "Paid cosmetics" section that says so (grep `placeholder badge
colors`).

### 5. Verify

```bash
npm run typecheck
javac -d /tmp/javac-check mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java
npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs
node scripts/generate-license-key.cjs <new_id>
```

- `javac` standalone works because `CosmeticCatalog` deliberately has zero
  Minecraft imports; the full `mod/` Gradle build is **CI-only** (Minecraft
  Maven deps are network-blocked here - same as always, see `mod/README.md`),
  so this syntax/type check is all the local Java verification you get.
- The smoke test exercises the real `licensing.ts` redeem path against
  `KNOWN_COSMETIC_IDS`.
- The generated key (`<id>-<12 hex chars>`) is the deliverable to hand the
  user - it's what redeems in Settings → Cosmetics. Note it's derived from the
  placeholder `LICENSE_SECRET` (`REPLACE_ME_WITH_YOUR_OWN_SECRET`) unless
  they've replaced it in BOTH `src/main/licensing.ts` and
  `scripts/generate-license-key.cjs`.
- Optional end-to-end UI check: the run-omega-client skill's `driver.mjs` can
  drive Settings → license field → Redeem against the mocked IPC; the smoke
  test above already covers the real logic more directly.

## Gotchas

- **`Map.of` caps at 10 entries.** `BADGE_COLORS` uses `java.util.Map.of(...)`,
  which won't compile past 10 pairs. At the 11th cosmetic, switch to
  `Map.ofEntries(Map.entry("id", 0xRRGGBB), ...)`. The standalone `javac` step
  catches this.
- **Java color is `0xRRGGBB`, no alpha byte.** It feeds
  `Style.withColor(int)`; `0xFFRRGGBB` would be a wrong (huge) int, not "opaque".
- **The extractor's `average` is usually the wrong answer** for multi-colored
  art (it mixes to mud - a mostly-dark logo averages near-black). That's why
  it's reported but never suggested; use `palette`/`suggestedBadge`.
- **Judge colors on the preview, not in isolation.** The nametag plate is 25%
  black over the world; the same purple that looks great as a swatch is
  invisible in a cave. This is exactly what step 2's three backdrops exist to
  catch.
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
