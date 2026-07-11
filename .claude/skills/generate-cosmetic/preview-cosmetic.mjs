#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Renders a gear cosmetic (hat/cape/wings) on a blocky stand-in player, from the REAL pipeline the
// mod ships: it javac-compiles GeometryDump.java together with the actual CosmeticCatalog/
// CosmeticGeometry/CosmeticPixelArt/CosmeticAnimation/CosmeticTrail sources (all zero-Minecraft-
// imports, so they compile standalone even though the full mod build is CI-only), runs the dump -
// production pixel-art parser, extruder, and (with --animate) production sway/flap animator - and
// paints the resulting quads with a tiny orthographic projector + painter's algorithm. The preview
// and the in-game shape/motion can't drift, because they're the same vertex data.
//
// For BADGE cosmetics use preview-badge.mjs (nametag readability is a different question).
//
// Usage:
//   node preview-cosmetic.mjs --id <cosmetic_id>              # a cosmetic already in the catalog
//   node preview-cosmetic.mjs --art <file.txt> --kind hat|cape|wings   # candidate art BEFORE wiring it in
//   (either form takes [--out file.png], [--animate], [--trail-color #hex] - see below)
//
// --animate replaces the static 3-view render with a filmstrip: two rows (standing still, full
// sprint) x six moments in time, single back-¾ camera, straight from CosmeticAnimation - so you can
// see the actual sway/flap range before shipping it. HAT and BADGE never move (CosmeticAnimation is
// a no-op for them), so --animate is only useful for CAPE/WINGS.
//
// --trail-color #RRGGBB (only meaningful together with --animate) draws each of
// CosmeticGeometry.tipPointsFor's tip points as a small glowing dot at that frame's animated
// position - the SAME local point (via CosmeticAnimation.animatePoint) CosmeticTrail's real particle
// spawn uses, so the dot's motion matches the real trail exactly. Omit it to preview a candidate
// trail color before wiring it in; for a catalog cosmetic that already has a trailColor, --animate
// draws its dots automatically without needing --trail-color at all (pass a different hex only to
// override/compare). This previews WHERE and HOW the trail moves in the cosmetic's own local frame -
// it does NOT exercise CosmeticTrail.toWorld's world/yaw placement (see that class's doc and
// SKILL.md's "particle trail model" section for why, and for what's separately verified instead).
//
// The art file uses CosmeticPixelArt's text format (palette lines "c=RRGGBB", then pixel rows,
// '.' = transparent) - the same text that will be pasted into CosmeticPixelArt.java, parsed by the
// same parser. A malformed grid fails here, before it ever reaches the mod.
//
// Screenshot path is printed (default $SCREENSHOT_DIR/cosmetic-preview-<name>[-anim].png,
// SCREENSHOT_DIR defaulting to /tmp/shots).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(skillDir, "../../..");
const COMMON_SOURCES = [
  "CosmeticCatalog.java",
  "CosmeticGeometry.java",
  "CosmeticPixelArt.java",
  "CosmeticAnimation.java",
  "CosmeticTrail.java",
].map((f) => path.join(repoRoot, "mod/common/src/main/java/com/omega/client/presence", f));

const args = process.argv.slice(2);
const opts = { id: "", art: "", kind: "", out: "", animate: false, trailColor: "" };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--animate") {
    opts.animate = true;
    continue;
  }
  const key = args[i] === "--trail-color" ? "trailColor" : args[i].replace(/^--/, "");
  if (key in opts) opts[key] = args[++i] ?? "";
}

if (opts.kind.toLowerCase() === "badge") {
  console.error("Badges have no geometry - preview them with preview-badge.mjs (nametag readability).");
  process.exit(1);
}
const candidateMode = Boolean(opts.art);
if (candidateMode ? !["hat", "cape", "wings"].includes(opts.kind.toLowerCase()) : !opts.id) {
  console.error("Usage: node preview-cosmetic.mjs --id <cosmetic_id> [--animate] [--trail-color #hex] [--out file.png]");
  console.error("       node preview-cosmetic.mjs --art <file.txt> --kind hat|cape|wings [--animate] [--trail-color #hex] [--out file.png]");
  process.exit(1);
}

function normalizeHex(input) {
  const m = /^(?:#|0x)?([0-9a-fA-F]{6})$/.exec((input ?? "").trim());
  return m ? parseInt(m[1], 16) : null;
}
let trailColorOverride = null;
if (opts.trailColor) {
  trailColorOverride = normalizeHex(opts.trailColor);
  if (trailColorOverride === null) {
    console.error(`--trail-color "${opts.trailColor}" isn't a color (expected #RRGGBB, RRGGBB, or 0xRRGGBB).`);
    process.exit(1);
  }
}

// Compile the dumper against the REAL mod sources and run it (fast enough to redo every run).
const classesDir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "omega-geom-"));
let dump;
try {
  execFileSync("javac", ["-d", classesDir, path.join(skillDir, "GeometryDump.java"), ...COMMON_SOURCES], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const javaArgs = ["-cp", classesDir, "com.omega.client.presence.GeometryDump"];
  if (opts.animate) javaArgs.push("--animate");
  if (candidateMode) javaArgs.push(path.resolve(opts.art), opts.kind.toLowerCase());
  else if (opts.animate) javaArgs.push(opts.id);
  dump = JSON.parse(execFileSync("java", javaArgs, { encoding: "utf-8" }));
} finally {
  fs.rmSync(classesDir, { recursive: true, force: true });
}

const name = candidateMode ? "candidate" : opts.id;
const playerQuads = dump.player;

// --- tiny orthographic projector (model space: y down, +z = player's back) ---
const toHex = (rgb) => "#" + rgb.toString(16).padStart(6, "0").toUpperCase();
const shadedCss = (rgb, shade) => {
  const r = Math.round(((rgb >> 16) & 0xff) * shade);
  const g = Math.round(((rgb >> 8) & 0xff) * shade);
  const b = Math.round((rgb & 0xff) * shade);
  return `rgb(${r},${g},${b})`;
};

/** Shared per-vertex transform used by both project() (mesh quads) and projectDots() (trail tips) - keeps their camera math identical. */
function projectVertex(X, Y, Z, yaw, pitch, scale, cx, cy) {
  const y = -Y; // to y-up
  const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
  const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const depth = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: cx + x1 * scale, y: cy - y2 * scale, depth };
}

function project(quads, yawDeg, pitchDeg, scale, cx, cy) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const polys = [];
  let maxArea = 1e-9;
  for (const quad of quads) {
    const pts = [];
    let depth = 0;
    for (let v = 0; v < 4; v++) {
      const vertex = projectVertex(quad.p[v * 3], quad.p[v * 3 + 1], quad.p[v * 3 + 2], yaw, pitch, scale, cx, cy);
      pts.push([vertex.x, vertex.y]);
      depth += vertex.depth;
    }
    let area = 0;
    for (let v = 0; v < 4; v++) {
      const [ax, ay] = pts[v];
      const [bx, by] = pts[(v + 1) % 4];
      area += ax * by - bx * ay;
    }
    area = Math.abs(area) / 2;
    maxArea = Math.max(maxArea, area);
    polys.push({ type: "poly", pts, depth: depth / 4, area, quad });
  }
  return { polys, maxArea };
}

/** Projects trail tip points [[x,y,z],...] the same way as mesh vertices, so a dot's depth sorts correctly against the mesh it should tuck behind or float in front of. */
function projectDots(points, colorHex, yawDeg, pitchDeg, scale, cx, cy) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  return points.map(([X, Y, Z]) => {
    const v = projectVertex(X, Y, Z, yaw, pitch, scale, cx, cy);
    return { type: "dot", x: v.x, y: v.y, depth: v.depth, colorHex };
  });
}

function svgView(gearQuads, label, yawDeg, pitchDeg, W, H, scale, tipPoints, trailColorHex) {
  const cx = W / 2, cy = H / 2 - 20;
  const { polys, maxArea } = project([...playerQuads, ...gearQuads], yawDeg, pitchDeg, scale, cx, cy);
  const dots = trailColorHex != null && tipPoints ? projectDots(tipPoints, trailColorHex, yawDeg, pitchDeg, scale, cx, cy) : [];
  // Painter's algorithm, far first (camera sits at +depth). Centroid depth alone misorders nested
  // near-coplanar mesh detail, so bias big faces slightly earlier - small accents (and dots, area 0)
  // draw on top of the large surface they sit against/in front of.
  const items = [...polys, ...dots].sort(
    (a, b) => (a.depth - 0.05 * ((a.area ?? 0) / maxArea)) - (b.depth - 0.05 * ((b.area ?? 0) / maxArea))
  );
  let shapes = "";
  for (const item of items) {
    if (item.type === "poly") {
      const fill = shadedCss(item.quad.rgb, item.quad.shade);
      const d = item.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      shapes += `<polygon points="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.4"/>`;
    } else {
      const fill = toHex(item.colorHex);
      shapes += `<circle cx="${item.x.toFixed(1)}" cy="${item.y.toFixed(1)}" r="7" fill="${fill}" opacity="0.35"/>`;
      shapes += `<circle cx="${item.x.toFixed(1)}" cy="${item.y.toFixed(1)}" r="3" fill="${fill}"/>`;
    }
  }
  return `<figure><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${shapes}</svg><figcaption>${label}</figcaption></figure>`;
}

const commonCss = `
  body { margin: 0; background: #1b1b1b; color: #ddd; font-family: monospace; padding: 18px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .legend { font-size: 13px; color: #bbb; margin-bottom: 10px; }
  .swatch { display: inline-block; width: 13px; height: 13px; vertical-align: -2px; margin: 0 6px 0 14px; border: 1px solid #555; }
  figure { margin: 0; background: linear-gradient(#26262c, #17171a); border: 1px solid #333; }
  figcaption { text-align: center; font-size: 12px; color: #999; padding: 5px 0 7px; text-transform: uppercase; letter-spacing: 1px; }
`;

function legendFor(gearQuads) {
  const colorCounts = new Map();
  for (const quad of gearQuads) colorCounts.set(quad.rgb, (colorCounts.get(quad.rgb) ?? 0) + 1);
  return [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rgb]) => `<span class="swatch" style="background:${toHex(rgb)}"></span>${toHex(rgb)}`)
    .join("");
}

let html;
let outSuffix;
if (opts.animate) {
  const trailColorHex = trailColorOverride ?? dump.trailColor; // dump.trailColor is the catalog cosmetic's own color, or null
  const motions = [...new Set(dump.frames.map((f) => f.motion))];
  const times = [...new Set(dump.frames.map((f) => f.t))];
  const frameOf = (t, motion) => dump.frames.find((f) => f.t === t && f.motion === motion);
  const rowLabel = (motion) => (motion === 0 ? "standing still" : motion >= 1 ? "full sprint" : `motion ${motion}`);
  const W = 170, H = 220, scale = 54;
  const rows = motions
    .map(
      (motion) => `<div class="row">
        <div class="row-label">${rowLabel(motion)}</div>
        <div class="frames">
          ${times
            .map((t) => {
              const frame = frameOf(t, motion);
              return svgView(frame.quads, `t=${t}`, 30, 12, W, H, scale, frame.tips, trailColorHex);
            })
            .join("")}
        </div>
      </div>`
    )
    .join("");
  const trailNote =
    trailColorHex != null
      ? `<div class="legend">trail:<span class="swatch" style="background:${toHex(trailColorHex)}"></span>${toHex(trailColorHex)}${trailColorOverride !== null ? " (override)" : " (catalog default)"}</div>`
      : `<div class="legend">trail: none${dump.frames[0].tips.length === 0 ? " (this kind has no tip - see CosmeticGeometry.tipPointsFor)" : " (no trailColor set - pass --trail-color to preview one)"}</div>`;
  html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${commonCss}
    .row { margin-bottom: 14px; }
    .row-label { font-size: 13px; color: #bbb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .frames { display: flex; gap: 8px; }
  </style></head><body>
    <h1>${name} (${dump.kind}) - animation filmstrip, back ¾ view, real CosmeticAnimation output</h1>
    <div class="legend">palette:${legendFor(dump.frames[0].quads)}</div>
    ${trailNote}
    ${rows}
  </body></html>`;
  outSuffix = "-anim";
} else {
  const entry = dump.cosmetics[name];
  if (!entry) {
    console.error(`No gear cosmetic "${name}" in the catalog. Available: ${Object.keys(dump.cosmetics).join(", ")}`);
    process.exit(1);
  }
  const gearQuads = entry.quads;
  const W = 260, H = 330, scale = 82; // player is ~2.6 units tall with gear margin
  html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${commonCss}
    .views { display: flex; gap: 14px; }
  </style></head><body>
    <h1>${name} (${entry.kind}) - real parser + extruder output</h1>
    <div class="legend">palette:${legendFor(gearQuads)}</div>
    <div class="views">
      ${svgView(gearQuads, "back ¾", 30, 12, W, H, scale)}
      ${svgView(gearQuads, "side", 90, 8, W, H, scale)}
      ${svgView(gearQuads, "front ¾", 210, 12, W, H, scale)}
    </div>
  </body></html>`;
  outSuffix = "";
}

const outFile = opts.out || path.join(process.env.SCREENSHOT_DIR || "/tmp/shots", `cosmetic-preview-${name}${outSuffix}.png`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.screenshot({ path: outFile, fullPage: true });
} finally {
  await browser.close();
}
console.log(outFile);
