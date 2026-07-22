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
  --gems N              accent studs placed evenly on the band layer, 0 disables (default 4)
  --crack               sprinkle --crack-color veins into body layers (off by default)
  --crack-sectors N     angular buckets used for crack placement (default 16)
  --crack-every N        place a crack every Nth bucket (default 4)
  --tip/--body/--crack-color/--band/--rim/--gem #hex   palette overrides (sane defaults given)
  --out file.txt        write output to a file instead of stdout

crown  (a real king's-crown silhouette: N spikes rising off a solid band, not a dome)
  --radius N            outer radius at the spike tips / band (default 5.6)
  --points N            number of spikes, evenly spaced (default 8)
  --point-halfwidth N   half-width in degrees of each spike wedge (default 16)

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
  points: "8", pointHalfwidth: "16",
  tipGlowLayers: "1", bandLayers: "1", rimLayers: "1", gems: "4",
  crack: false, crackSectors: "16", crackEvery: "4",
  tip: "FFFFFF", body: "2B2B2B", crackColor: "FF9933", band: "C9A227", rim: "1A1A1A", gem: "B3122A",
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

/** Places single-cell accents (gems, studs, chain nubs) at evenly-spaced absolute angles and a fixed radius. */
function placeAccents(grid, { count, radius, char, startDeg = 0 }) {
  for (let i = 0; i < count; i++) {
    const deg = startDeg + (360 * i) / count;
    const rad = (deg * Math.PI) / 180;
    const x = Math.round(cx + radius * Math.cos(rad));
    const z = Math.round(cz + radius * Math.sin(rad));
    if (x >= 0 && x < W && z >= 0 && z < D) grid[z][x] = char;
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
  const tipGlowLayers = Math.min(o.tipGlowLayers, height);
  const bandLayers = o.bandLayers;
  const rimLayers = o.rimLayers;
  const coreLayers = height - bandLayers - rimLayers;
  if (coreLayers < 1) throw new Error("--height too small for the requested --band-layers/--rim-layers");
  const angles = Array.from({ length: points }, (_, i) => (360 * i) / points);

  const layers = [];
  for (let i = 0; i < coreLayers; i++) {
    const t = coreLayers === 1 ? 1 : i / (coreLayers - 1);
    // Core radius ramps from "no core at all" (bare points, t=0) to the full band radius (t=1) -
    // points stay at `radius` throughout, so the core visibly grows UP to meet them rather than
    // the whole shape ballooning outward together (that's what erases the spikes into a blob).
    const coreRadius = lerp(-1, radius, t);
    const pointRadius = radius;
    const fill = i < tipGlowLayers ? "tip" : "body";
    let grid = radialPointMask(coreRadius, pointRadius, angles, halfwidth, fill);
    if (o.crack && fill === "body") {
      grid = addCracks(grid, { baseChar: "body", crackChar: "crack", sectorCount: o.crackSectors, everyN: o.crackEvery });
    }
    layers.push(grid);
  }
  for (let i = 0; i < bandLayers; i++) {
    const grid = discMask(radius, "band");
    if (i === bandLayers - 1 && o.gems > 0) placeAccents(grid, { count: o.gems, radius: radius - 0.8, char: "gem" });
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
    if (i === bandLayers - 1 && o.gems > 0) placeAccents(grid, { count: o.gems, radius: o.radius - 0.8, char: "gem" });
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
    if (i === bandLayers - 1 && o.gems > 0) placeAccents(grid, { count: o.gems, radius: o.radius - 0.8, char: "gem" });
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
  band: normalizeHex(opts.band, "--band"),
  rim: normalizeHex(opts.rim, "--rim"),
  gem: normalizeHex(opts.gem, "--gem"),
};
// One-letter palette keys, assigned in a fixed, memorable order (t/b/c/n/r/g); only the roles a
// shape actually uses end up referenced by any cell, but all six are always declared so the
// palette line count is predictable to scan.
const KEY = { tip: "t", body: "b", crack: "c", band: "n", rim: "r", gem: "g" };

const defaultHeight = { crown: 8, dome: 6, bucket: 10, cone: 8 };
const defaultRadius = { crown: 5.6, dome: 5.5, bucket: 4.5, cone: 5.5 };
const shapeOpts = {
  height: parseInt(opts.height || defaultHeight[opts.shape], 10),
  radius: parseFloat(opts.radius || defaultRadius[opts.shape]),
  radiusTop: opts.radiusTop === "" ? -1 : parseFloat(opts.radiusTop),
  brimRadius: parseFloat(opts.brimRadius),
  brimLayers: parseInt(opts.brimLayers, 10),
  points: parseInt(opts.points, 10),
  pointHalfwidth: parseFloat(opts.pointHalfwidth),
  tipGlowLayers: parseInt(opts.tipGlowLayers, 10),
  bandLayers: parseInt(opts.bandLayers, 10),
  rimLayers: parseInt(opts.rimLayers, 10),
  gems: parseInt(opts.gems, 10),
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
