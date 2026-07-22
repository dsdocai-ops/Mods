#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Parametric starting shapes for voxel HAT art (CosmeticPixelArt.VoxelArt - see SKILL.md's "Voxel
// hats" section). Exists because a voxel hat is a stack of top-down 2D slices, and getting the
// *shape* of that stack right - a real dome/crown silhouette instead of a rounded blob - means
// getting a handful of interacting radius/angle equations right (per-layer core radius, per-layer
// point/spike radius, where a band or brim takes over, where accents sit). Hand-typing that from
// scratch per cosmetic is exactly what produced the first Molten Crown hat's "muddy blob" - the
// silhouette math was invented under time pressure and the taper was too gradual to read as a
// crown. This module is the reusable fix: four named shape families (crown/dome/bucket/cone) built
// from the same small set of primitives (disc mask, radial point mask, crack texture, ring overlay,
// angle-placed accents), so a new hat starts from a shape that is ALREADY structurally correct and
// only needs palette/accent tuning, not shape invention.
//
// Usage:
//   node voxel-hat-builder.mjs --shape crown [--width 14] [--depth 14] [--height 8] [--radius 5.6]
//       [--points 8] [--point-halfwidth 16] [--tip-glow-layers 1] [--band-layers 1] [--rim-layers 1]
//       [--gems 4] [--crack] [--crack-sectors 16] [--crack-every 4]
//       [--tip #hex] [--body #hex] [--crack-color #hex] [--band #hex] [--rim #hex] [--gem #hex]
//       [--out file.txt]
//   node voxel-hat-builder.mjs --shape dome   --radius 5.5 --radius-top 2.0 --height 6 ...
//   node voxel-hat-builder.mjs --shape bucket --radius 4.5 --brim-radius 7 --brim-layers 2 ...
//   node voxel-hat-builder.mjs --shape cone   --radius 5.5 --radius-top 0   --height 8 ...
//
// Prints the raw CosmeticPixelArt voxel text (for `preview-cosmetic.mjs --art <file> --kind hat`)
// and a ready-to-paste Java text block for CosmeticPixelArt.java, same two-part convention as
// pixelate.mjs's flat-art output. ALWAYS preview before pasting into Java (see SKILL.md workflow
// step 2) - this generates a structurally sound base shape, not a finished, hand-tuned cosmetic;
// real pixel art still means editing rows afterward (an off-color fleck, an asymmetric accent, a
// second palette color for depth) exactly as SKILL.md's "From a description" section describes for
// flat art. Grid sizes are free but stay near the canonical voxel HAT frame (roughly 14w x 8-10h x
// 14d - see CosmeticGeometry / SKILL.md) so pixels stay square and the hat sits right on the head.

import fs from "node:fs";

function usage() {
  console.error(`Usage: node voxel-hat-builder.mjs --shape crown|dome|bucket|cone [options]

Shared options:
  --width N            grid width (default 14)
  --depth N             grid depth (default 14)
  --height N            number of layers, top to bottom (default depends on shape)
  --tip-glow-layers N   topmost layers colored with --tip instead of --body (default 1)
  --band-layers N       solid full-disc trim/band layers before the rim (default 1)
  --rim-layers N        solid full-disc layers at the very bottom (default 1)
  --gems N              focal accents on the band layer, 0 disables (default 1 - ONE bold accent
                        at the front, not several small ones; see --gem-size)
  --gem-size N          0 = single cell, 1 = 5-cell plus (default), 2 = 9-cell diamond - a single
                        cell is nearly invisible at this render scale, use it only for a repeated
                        small detail (rivets), not a cosmetic's one focal accent
  --gem-start-deg N     angle of the first gem; 270 (default) is the front-facing cell
  --crack               sprinkle --crack-color veins into body layers (OFF by default - a clean
                        flat color band reads as "designed"; scattered crack texture reads as
                        noise unless used sparingly - see "Judging..." below before turning this on)
  --crack-sectors N     angular buckets used for crack placement (default 16)
  --crack-every N        place a crack every Nth bucket (default 4)
  --tip/--body/--crack-color/--trim/--band/--rim/--gem #hex   palette overrides (sane defaults given)
  --body-stops c1,c2,c3,...   optional multi-color vertical gradient for the body mass (dark to
                        bright, or vice versa - order top-to-bottom), instead of one flat --body
                        color. Each layer in the spike/core span gets the nearest stop for its
                        position, so a "glowing embers in cooling rock" or "dark base to bright
                        tip" read becomes a real multi-band gradient, not a single flat color -
                        overrides --body when given (3-5 stops is plenty; each is still one FLAT
                        color per layer, this is a discrete step gradient, not a smooth blend).
  --out file.txt        write output to a file instead of stdout

crown  (a real king's-crown silhouette: N separated spikes over a trim ring over a band - NOT a
        scalloped dome; see "Judging..." below for why point count/width matters here)
  --radius N            outer radius at the spike tips / band (default 5.6)
  --points N            number of spikes, evenly spaced (default 5 - fewer, wider-spaced points
                        read as distinct spikes; 8+ points blur into a bumpy dome at this grid size)
  --point-halfwidth N   half-width in degrees of each spike wedge (default 9 - keep this narrow
                        relative to 360/points, or the gaps between spikes disappear entirely)
  --prong-layers N      top layers that are PURE spikes with no core at all, so the gaps between
                        them are real transparent space (default 3)
  --trim-layers N       thin flat-colored ring between the spikes and the band - a real crown's
                        fur trim (default 1)
  --alt-height F        0 (default, disabled) to 1: makes every OTHER point shorter by this
                        fraction of the prong span, so points read tall-short-tall-short like a
                        real king's crown instead of all-identical - e.g. 0.5 means the minor
                        points only occupy the bottom half of the prong layers

dome   (a smooth rounded cap, radius tapering from top to bottom - skullcaps, rounded helmets)
  --radius N            radius at the bottom-most dome layer (default 5.5)
  --radius-top N        radius at the topmost layer (default radius * 0.3)

bucket (a rounded crown + a flared brim - bucket hats, wide-brim hats)
  --radius N            crown radius (default 4.5)
  --brim-radius N       outer brim radius, must exceed --radius (default 7.0)
  --brim-layers N       how many of the bottom layers flare out to the brim (default 2)

cone   (a single-apex taper - wizard hats, witch hats)
  --radius N            base radius (default 5.5)
  --radius-top N        apex radius, 0 for a true point (default 0)
`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}
const opts = {
  shape: "", width: "14", depth: "14", height: "",
  radius: "", radiusTop: "", brimRadius: "7.0", brimLayers: "2",
  points: "5", pointHalfwidth: "9", prongLayers: "3", trimLayers: "1", altHeight: "0",
  tipGlowLayers: "1", bandLayers: "1", rimLayers: "1", gems: "1", gemSize: "1", gemStartDeg: "270",
  crack: false, crackSectors: "16", crackEvery: "4",
  tip: "FFFFFF", body: "3D6E8C", crackColor: "FF9933", trim: "F0EAD8", band: "C9A227", rim: "1A1A1A", gem: "B3122A",
  bodyStops: "",
  out: "",
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--crack") {
    opts.crack = true;
    continue;
  }
  const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (key in opts) opts[key] = args[++i] ?? "";
}
if (!["crown", "dome", "bucket", "cone"].includes(opts.shape)) {
  console.error(`--shape must be crown, dome, bucket, or cone (got "${opts.shape}")`);
  process.exit(1);
}

function normalizeHex(input, label) {
  const m = /^(?:#|0x)?([0-9a-fA-F]{6})$/.exec((input ?? "").trim());
  if (!m) {
    console.error(`${label} "${input}" isn't a color (expected #RRGGBB, RRGGBB, or 0xRRGGBB).`);
    process.exit(1);
  }
  return m[1].toUpperCase();
}

const W = parseInt(opts.width, 10);
const D = parseInt(opts.depth, 10);
const cx = (W - 1) / 2;
const cz = (D - 1) / 2;

// --- primitives -------------------------------------------------------------------------------

/** A blank W x D grid of transparent cells ('.'). */
function makeGrid() {
  return Array.from({ length: D }, () => Array(W).fill("."));
}

/** Fills every cell within `radius` of center with `fill` - a plain top-down disc. */
function discMask(radius, fill, grid = makeGrid()) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, z - cz) <= radius) grid[z][x] = fill;
    }
  }
  return grid;
}

/**
 * Fills a disc of radius `coreRadius` (or nothing, if coreRadius < 0) PLUS, only within angular
 * wedges centered on `pointAngles` (each `pointHalfwidthDeg` wide), everything out to `pointRadius`.
 * This is the shape a crown's cross-section actually is at any given height: a same-for-every-angle
 * core (possibly empty, near the top) with spikes as angular exceptions reaching further out - NOT
 * a uniformly-tapered dome with bumps carved into it, which is what reads as a "blob" instead of a
 * crown. pointRadius should be >= coreRadius or the spikes recede into the core instead of rising
 * above it.
 */
function radialPointMask(coreRadius, pointRadius, pointAngles, pointHalfwidthDeg, fill, grid = makeGrid()) {
  const angDiff = (a, b) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
  const onPoint = (deg) => pointAngles.some((pa) => angDiff(deg, pa) <= pointHalfwidthDeg);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dz = z - cz;
      const d = Math.hypot(dx, dz);
      const deg = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
      const limit = onPoint(deg) ? pointRadius : coreRadius;
      if (limit >= 0 && d <= limit) grid[z][x] = fill;
    }
  }
  return grid;
}

/**
 * Deterministically replaces some `baseChar` cells with `crackChar` in thin radial veins (every
 * `everyN`th of `sectorCount` angular buckets), evoking cracked rock/lava veins without scattering
 * random noise across the whole surface - real pixel art reads as a few deliberate lines, not static.
 */
function addCracks(grid, { baseChar, crackChar, sectorCount = 16, everyN = 4, minRadius = 1.5 }) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (grid[z][x] !== baseChar) continue;
      const dx = x - cx, dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d <= minRadius) continue;
      const deg = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
      const bucket = Math.floor(deg / (360 / sectorCount));
      if (bucket % everyN === 0) grid[z][x] = crackChar;
    }
  }
  return grid;
}

/**
 * Places accents (gems, studs, chain nubs) at evenly-spaced absolute angles and a fixed radius.
 * `size: 0` (default) is a single cell - fine for a repeated small detail (a row of rivets), but a
 * single voxel is genuinely hard to see in the preview's render scale (see the Molten Crown's first
 * four cardinal gems, which were structurally present but essentially invisible). For a cosmetic's
 * ONE focal accent - the thing meant to catch the eye, not just texture the surface - use `size: 1`
 * (a 5-cell plus/diamond) or `size: 2` (a fuller diamond) so it actually reads as a mounted gem
 * instead of a stray colored pixel.
 */
function placeAccents(grid, { count, radius, char, startDeg = 0, size = 0 }) {
  for (let i = 0; i < count; i++) {
    const deg = startDeg + (360 * i) / count;
    const rad = (deg * Math.PI) / 180;
    const cxi = Math.round(cx + radius * Math.cos(rad));
    const czi = Math.round(cz + radius * Math.sin(rad));
    const offsets = size <= 0 ? [[0, 0]]
      : size === 1 ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [ox, oz] of offsets) {
      const x = cxi + ox, z = czi + oz;
      if (x >= 0 && x < W && z >= 0 && z < D) grid[z][x] = char;
    }
  }
  return grid;
}

/** Overwrites an annulus (rOuter >= d > rInner) of an existing grid - used for a brim's outer rim ring. */
function ringOverlay(grid, { rOuter, rInner, char }) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d <= rOuter && d > rInner) grid[z][x] = char;
    }
  }
  return grid;
}

const lerp = (a, b, t) => a + (b - a) * t;

// --- shape builders -----------------------------------------------------------------------------
// Each returns an array of grids, top layer first, ready for gridsToRows(). All taper math lives
// here so a new cosmetic reuses a shape that is already correct, instead of re-deriving it.

function buildCrown(o) {
  const radius = o.radius;
  const points = o.points;
  const halfwidth = o.pointHalfwidth;
  const height = o.height;
  const bandLayers = o.bandLayers;
  const rimLayers = o.rimLayers;
  const trimLayers = o.trimLayers;
  // Fewer, narrower points read as distinct spikes with visible gaps between them (like a real
  // crown silhouette); many wide points blur into a scalloped dome instead - see the "Judging..."
  // section for why (at this pixel budget the gap between points is only a couple of pixels wide
  // to begin with, so a wide halfwidth or a high point count erases it entirely).
  const prongLayers = Math.min(o.prongLayers, height);
  const mergeLayers = height - prongLayers - trimLayers - bandLayers - rimLayers;
  if (mergeLayers < 1) {
    throw new Error("--height too small for the requested --prong-layers/--trim-layers/--band-layers/--rim-layers");
  }
  const allAngles = Array.from({ length: points }, (_, i) => (360 * i) / points);
  // Alternating tall/short points (a real king's crown silhouette, not identical uniform spikes):
  // "minor" points (odd index) simply don't exist yet in the topmost layers, so they read shorter
  // without needing a second radius system - they're absent, not smaller.
  const majorAngles = o.altHeight > 0 ? allAngles.filter((_, i) => i % 2 === 0) : allAngles;
  const minorAngles = o.altHeight > 0 ? allAngles.filter((_, i) => i % 2 === 1) : [];

  const tipUsed = o.tipGlowLayers > 0;
  const bodyLayerCount = prongLayers + mergeLayers - (tipUsed ? 1 : 0);
  let bodyLayerIndex = 0;
  const nextBodyRole = () => {
    const t = bodyLayerCount <= 1 ? 0 : bodyLayerIndex / (bodyLayerCount - 1);
    bodyLayerIndex++;
    return o.bodyRoleAt(t);
  };

  const layers = [];
  // Prong-only layers: NO core at all (coreRadius -1), so the gap between points is real
  // transparent space, not a shallow notch in an otherwise-solid disc - this is what makes them
  // read as separate raised spikes instead of a bumpy dome edge. Point radius tapers in from a
  // narrower tip to the full radius, so each spike is a real triangular point, not a uniform post.
  for (let i = 0; i < prongLayers; i++) {
    const t = prongLayers === 1 ? 1 : i / (prongLayers - 1);
    const pointRadius = lerp(radius * 0.55, radius, t);
    const minorActive = minorAngles.length > 0 && (prongLayers === 1 || i / (prongLayers - 1) >= 1 - o.altHeight);
    const anglesForLayer = minorActive ? allAngles : majorAngles;
    const fill = i === 0 && tipUsed ? "tip" : nextBodyRole();
    layers.push(radialPointMask(-1, pointRadius, anglesForLayer, halfwidth, fill));
  }
  // Merge layers: core radius ramps from bare (matches the last prong layer) up to the full band
  // radius, so the points visually plant into a solid base instead of either floating disconnected
  // or being absorbed into it immediately. Points are already fully merged/round by now, so every
  // angle is back in play regardless of the prong phase's major/minor split.
  for (let i = 0; i < mergeLayers; i++) {
    const t = mergeLayers === 1 ? 1 : i / (mergeLayers - 1);
    const coreRadius = lerp(-1, radius, t);
    const role = nextBodyRole();
    let grid = radialPointMask(coreRadius, radius, allAngles, halfwidth, role);
    if (o.crack) grid = addCracks(grid, { baseChar: role, crackChar: "crack", sectorCount: o.crackSectors, everyN: o.crackEvery });
    layers.push(grid);
  }
  // Trim: a distinct, thin, flat-colored ring between the spikes and the main band (the "white fur
  // trim" a real crown has) - one clean color block, not a blend, per the "clean bands over noisy
  // texture" lesson in the "Judging..." section.
  for (let i = 0; i < trimLayers; i++) layers.push(discMask(radius, "trim"));
  // Band: the main colored body, carrying ONE bold, multi-cell focal accent (not several
  // single-pixel dots, which are nearly invisible at this render scale) at the front by default.
  for (let i = 0; i < bandLayers; i++) {
    const grid = discMask(radius, "band");
    if (i === bandLayers - 1 && o.gems > 0) {
      // Inset well past the disc edge (not just ~1px) - a size:1/2 gem is a 3x3 or wider cluster,
      // and placing its CENTER only ~1px from the boundary clips it into a ragged partial shape
      // that reads as a texture glitch, not a mounted gem (see the "Judging..." section).
      placeAccents(grid, { count: o.gems, radius: radius - 1.6, char: "gem", startDeg: o.gemStartDeg, size: o.gemSize });
    }
    layers.push(grid);
  }
  for (let i = 0; i < rimLayers; i++) layers.push(discMask(radius, "rim"));
  return layers;
}

function buildDome(o) {
  const height = o.height;
  const bandLayers = o.bandLayers;
  const rimLayers = o.rimLayers;
  const domeLayers = height - bandLayers - rimLayers;
  if (domeLayers < 1) throw new Error("--height too small for the requested --band-layers/--rim-layers");
  const tipGlowLayers = Math.min(o.tipGlowLayers, domeLayers);
  const radiusTop = o.radiusTop >= 0 ? o.radiusTop : o.radius * 0.3;

  const layers = [];
  for (let i = 0; i < domeLayers; i++) {
    const t = domeLayers === 1 ? 1 : i / (domeLayers - 1);
    // ease-out: rounds the dome instead of a linear (conical) taper
    const eased = 1 - (1 - t) * (1 - t);
    const r = lerp(radiusTop, o.radius, eased);
    const fill = i < tipGlowLayers ? "tip" : "body";
    let grid = discMask(r, fill);
    if (o.crack && fill === "body") {
      grid = addCracks(grid, { baseChar: "body", crackChar: "crack", sectorCount: o.crackSectors, everyN: o.crackEvery });
    }
    layers.push(grid);
  }
  for (let i = 0; i < bandLayers; i++) {
    const grid = discMask(o.radius, "band");
    if (i === bandLayers - 1 && o.gems > 0) placeAccents(grid, { count: o.gems, radius: o.radius - 1.4, char: "gem", startDeg: o.gemStartDeg ?? 270, size: o.gemSize ?? 1 });
    layers.push(grid);
  }
  for (let i = 0; i < rimLayers; i++) layers.push(discMask(o.radius, "rim"));
  return layers;
}

function buildBucket(o) {
  const height = o.height;
  const brimLayers = o.brimLayers;
  const crownLayers = height - brimLayers;
  if (crownLayers < 2) throw new Error("--height too small for the requested --brim-layers (need >=2 crown layers)");
  const tipGlowLayers = Math.min(o.tipGlowLayers, crownLayers);
  if (o.brimRadius <= o.radius) throw new Error("--brim-radius must exceed --radius for a bucket hat");

  const layers = [];
  for (let i = 0; i < crownLayers; i++) {
    const t = crownLayers === 1 ? 1 : i / (crownLayers - 1);
    // rounded top: first couple of layers taper in from the crown radius, then hold it steady -
    // same "rounded top, cylindrical wall" silhouette a real bucket hat has.
    const roundedTop = Math.min(1, t * 2.2);
    const eased = 1 - (1 - roundedTop) * (1 - roundedTop);
    const r = lerp(o.radius * 0.55, o.radius, eased);
    const fill = i < tipGlowLayers ? "tip" : "body";
    let grid = discMask(r, fill);
    if (o.crack && fill === "body") {
      grid = addCracks(grid, { baseChar: "body", crackChar: "crack", sectorCount: o.crackSectors, everyN: o.crackEvery });
    }
    layers.push(grid);
  }
  for (let i = 0; i < brimLayers; i++) {
    const t = brimLayers === 1 ? 1 : i / (brimLayers - 1);
    const r = lerp(o.radius, o.brimRadius, t);
    let grid = discMask(r, "band");
    if (i === brimLayers - 1) grid = ringOverlay(grid, { rOuter: r, rInner: r - 1.0, char: "rim" });
    layers.push(grid);
  }
  return layers;
}

function buildCone(o) {
  const height = o.height;
  const bandLayers = o.bandLayers;
  const rimLayers = o.rimLayers;
  const coneLayers = height - bandLayers - rimLayers;
  if (coneLayers < 1) throw new Error("--height too small for the requested --band-layers/--rim-layers");
  const tipGlowLayers = Math.min(o.tipGlowLayers, coneLayers);
  const radiusTop = o.radiusTop >= 0 ? o.radiusTop : 0;

  const layers = [];
  for (let i = 0; i < coneLayers; i++) {
    const t = coneLayers === 1 ? 1 : i / (coneLayers - 1);
    const r = lerp(radiusTop, o.radius, t); // linear taper - a straight-sided cone, unlike dome's ease-out
    const fill = i < tipGlowLayers ? "tip" : "body";
    let grid = discMask(r, fill);
    if (o.crack && fill === "body") {
      grid = addCracks(grid, { baseChar: "body", crackChar: "crack", sectorCount: o.crackSectors, everyN: o.crackEvery });
    }
    layers.push(grid);
  }
  for (let i = 0; i < bandLayers; i++) {
    const grid = discMask(o.radius, "band");
    if (i === bandLayers - 1 && o.gems > 0) placeAccents(grid, { count: o.gems, radius: o.radius - 1.4, char: "gem", startDeg: o.gemStartDeg ?? 270, size: o.gemSize ?? 1 });
    layers.push(grid);
  }
  for (let i = 0; i < rimLayers; i++) layers.push(discMask(o.radius, "rim"));
  return layers;
}

// --- assemble, validate, print -------------------------------------------------------------------

const colorOf = {
  tip: normalizeHex(opts.tip, "--tip"),
  body: normalizeHex(opts.body, "--body"),
  crack: normalizeHex(opts.crackColor, "--crack-color"),
  trim: normalizeHex(opts.trim, "--trim"),
  band: normalizeHex(opts.band, "--band"),
  rim: normalizeHex(opts.rim, "--rim"),
  gem: normalizeHex(opts.gem, "--gem"),
};
// One-letter palette keys, assigned in a fixed, memorable order; only the roles a shape actually
// uses end up referenced by any cell, but all seven are always declared so the palette line count
// is predictable to scan.
const KEY = { tip: "t", body: "b", crack: "c", trim: "m", band: "n", rim: "r", gem: "g" };
// Extra letters for --body-stops' dynamically-named body0/body1/... roles - the fixed roles above
// never use these, so there's no collision risk.
const GRADIENT_LETTERS = ["a", "d", "e", "h", "i", "j", "k", "l", "o", "p", "q", "s", "u", "v", "w"];

// --body-stops turns the single flat --body color into a multi-band top-to-bottom gradient (still
// one flat color per LAYER - a discrete step gradient, not a smooth blend, since a single voxel/
// pixel cell can only be one color). Falls back to the plain single "body" role when omitted, so
// every existing call site that used a hardcoded "body" fill keeps working unchanged.
const bodyStops = opts.bodyStops
  ? opts.bodyStops.split(",").map((h, i) => normalizeHex(h, `--body-stops[${i}]`))
  : [colorOf.body];
if (bodyStops.length > 1) {
  bodyStops.forEach((hex, i) => {
    const role = `body${i}`;
    KEY[role] = GRADIENT_LETTERS[i] ?? String.fromCharCode(97 + 20 + i); // extremely unlikely to run out
    colorOf[role] = hex;
  });
}
/** t=0 at the tip/top end of the body span, t=1 at the band end - see --body-stops above. */
function bodyRoleAt(t) {
  if (bodyStops.length <= 1) return "body";
  return `body${Math.round(t * (bodyStops.length - 1))}`;
}

const defaultHeight = { crown: 9, dome: 6, bucket: 10, cone: 8 };
const defaultRadius = { crown: 5.6, dome: 5.5, bucket: 4.5, cone: 5.5 };
const shapeOpts = {
  height: parseInt(opts.height || defaultHeight[opts.shape], 10),
  radius: parseFloat(opts.radius || defaultRadius[opts.shape]),
  radiusTop: opts.radiusTop === "" ? -1 : parseFloat(opts.radiusTop),
  brimRadius: parseFloat(opts.brimRadius),
  brimLayers: parseInt(opts.brimLayers, 10),
  points: parseInt(opts.points, 10),
  pointHalfwidth: parseFloat(opts.pointHalfwidth),
  prongLayers: parseInt(opts.prongLayers, 10),
  trimLayers: parseInt(opts.trimLayers, 10),
  altHeight: parseFloat(opts.altHeight),
  bodyRoleAt,
  tipGlowLayers: parseInt(opts.tipGlowLayers, 10),
  bandLayers: parseInt(opts.bandLayers, 10),
  rimLayers: parseInt(opts.rimLayers, 10),
  gems: parseInt(opts.gems, 10),
  gemSize: parseInt(opts.gemSize, 10),
  gemStartDeg: parseFloat(opts.gemStartDeg),
  crack: opts.crack,
  crackSectors: parseInt(opts.crackSectors, 10),
  crackEvery: parseInt(opts.crackEvery, 10),
};

let layers;
try {
  if (opts.shape === "crown") layers = buildCrown(shapeOpts);
  else if (opts.shape === "dome") layers = buildDome(shapeOpts);
  else if (opts.shape === "bucket") layers = buildBucket(shapeOpts);
  else layers = buildCone(shapeOpts);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

function gridsToRows(grids) {
  return grids.map((grid) => grid.map((row) => row.map((cell) => (cell === "." ? "." : KEY[cell])).join("")));
}
const layerRows = gridsToRows(layers);

// Self-check: CosmeticPixelArt.parseVoxel throws on ragged rows/layers - catch that here, not at
// preview time. (>=2 layers is also required by the real parser; every builder above produces more.)
for (const rows of layerRows) {
  if (rows.length !== D) throw new Error(`internal error: layer has ${rows.length} rows, expected depth ${D}`);
  for (const row of rows) {
    if (row.length !== W) throw new Error(`internal error: row is ${row.length} wide, expected width ${W}`);
  }
}

const usedKeys = new Set(layerRows.flat().join("").split("").filter((c) => c !== "."));
const paletteLines = Object.entries(KEY)
  .filter(([role]) => usedKeys.has(KEY[role]))
  .map(([role, key]) => `${key}=${colorOf[role]}`);

// --- value-contrast check ---------------------------------------------------------------------
// Faces are shaded using vanilla Minecraft's real per-direction table (CosmeticGeometry.shadeOf):
// up 1.0, down 0.5, one horizontal axis 0.8, the other 0.6. That's the ONLY lighting this pipeline
// has (flat position-color quads, no normals/light at render time), so a bulk-fill color's
// lightness decides whether those four multipliers read as a lit 3D shape or collapse into one
// flat mass. This is exactly how the first Molten Crown draft went wrong: a structurally correct
// crown shape filled with a near-black body color (lightness ~0.07) whose shaded faces were all
// still near-black, so it rendered as a muddy blob despite the shape being right - the fix was a
// palette problem, not a geometry problem. Warn here so that mistake is caught before the first
// preview, not after.
function hexToRgb01(hex) {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
function lightnessOf(hex) {
  const [r, g, b] = hexToRgb01(hex);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}
function saturationOf(hex) {
  const [r, g, b] = hexToRgb01(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}
// body/band (and any body0/body1/... --body-stops roles) typically cover a large, multi-orientation
// surface (the hat's bulk mass); tip/crack/gem/rim/trim are deliberately small accents where a
// lightness extreme is fine (a bright glowing tip, a near-black thin rim line) since there's barely
// any face area for the shading spread to show up on regardless.
const bulkRoles = Object.keys(KEY).filter((role) => role === "band" || role === "body" || /^body\d+$/.test(role));
for (const role of bulkRoles) {
  if (!usedKeys.has(KEY[role])) continue;
  const hex = colorOf[role];
  const l = lightnessOf(hex);
  const s = saturationOf(hex);
  if (l < 0.2 || l > 0.85) {
    console.error(
      `warning: --${role} #${hex} has lightness ${l.toFixed(2)} - a near-${l < 0.5 ? "black" : "white"} ` +
      `bulk color collapses the vanilla 1.0/0.8/0.6/0.5 shading spread into one flat mass instead of a lit ` +
      `3D shape. Prefer roughly 0.35-0.65 lightness for any color covering a large fill; save near-black/` +
      `near-white for thin trim or outline accents, where there's little face area for the shading to show on.`
    );
  } else if (s < 0.15) {
    console.error(
      `warning: --${role} #${hex} is nearly grayscale (saturation ${s.toFixed(2)}) - a vivid, saturated ` +
      `hue reads as deliberately designed at this scale; a desaturated one tends to read flat/generic.`
    );
  }
}

const rawLines = [...paletteLines];
layerRows.forEach((rows, i) => {
  if (i > 0) rawLines.push("---");
  rawLines.push(...rows);
});
const raw = rawLines.join("\n");

if (opts.out) {
  fs.writeFileSync(opts.out, raw + "\n");
  console.log(`# written to ${opts.out}`);
}
console.log(`# ${opts.shape} hat, ${W}x${layers.length}x${D} - preview with: preview-cosmetic.mjs --art ${opts.out || "<file>"} --kind hat`);
console.log(raw);
console.log("\n# Java text block for CosmeticPixelArt.java:");
console.log('    public static final VoxelArt NEW_HAT = parseVoxel("""');
for (const line of rawLines) console.log(`            ${line}`);
console.log('            """);');
