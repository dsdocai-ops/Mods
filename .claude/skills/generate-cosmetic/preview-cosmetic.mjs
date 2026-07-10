#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Renders a gear cosmetic (hat/cape/wings) in candidate colors on a blocky stand-in player, from
// the REAL geometry the mod ships: it javac-compiles GeometryDump.java together with the actual
// CosmeticCatalog/CosmeticGeometry sources (all zero-Minecraft-imports, so they compile standalone
// even though the full mod build is CI-only), runs the dump, and paints the resulting quads with a
// tiny orthographic projector + painter's algorithm. The preview and the in-game shape can't drift,
// because they're the same vertex data.
//
// For BADGE cosmetics use preview-badge.mjs (nametag readability is a different question).
//
// Usage: node .claude/skills/generate-cosmetic/preview-cosmetic.mjs --kind hat|cape|wings \
//          --primary <#RRGGBB|0xRRGGBB> --secondary <#RRGGBB|0xRRGGBB> [--out file.png]
//
// Colors are applied at render time - trying a new palette needs no recompile. Screenshot path is
// printed (default $SCREENSHOT_DIR/cosmetic-preview-<kind>.png, SCREENSHOT_DIR defaulting to /tmp/shots).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(skillDir, "../../..");

const args = process.argv.slice(2);
const opts = { kind: "", primary: "", secondary: "", out: "" };
for (let i = 0; i < args.length; i++) {
  const key = args[i].replace(/^--/, "");
  if (key in opts) opts[key] = args[++i] ?? "";
}

function normalize(input) {
  const m = /^(?:#|0x)?([0-9a-fA-F]{6})$/.exec((input ?? "").trim());
  return m ? parseInt(m[1], 16) : null;
}

const kind = opts.kind.toLowerCase();
if (kind === "badge") {
  console.error("Badges have no geometry - preview them with preview-badge.mjs (nametag readability).");
  process.exit(1);
}
const primary = normalize(opts.primary);
const secondary = normalize(opts.secondary ?? opts.primary);
if (!["hat", "cape", "wings"].includes(kind) || primary === null || secondary === null) {
  console.error("Usage: node preview-cosmetic.mjs --kind hat|cape|wings --primary #RRGGBB --secondary #RRGGBB [--out file.png]");
  process.exit(1);
}

// Compile the dumper against the REAL mod sources and run it (fast enough to redo every run).
const classesDir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "omega-geom-"));
let geometry;
try {
  execFileSync("javac", [
    "-d", classesDir,
    path.join(skillDir, "GeometryDump.java"),
    path.join(repoRoot, "mod/common/src/main/java/com/omega/client/presence/CosmeticCatalog.java"),
    path.join(repoRoot, "mod/common/src/main/java/com/omega/client/presence/CosmeticGeometry.java"),
  ], { stdio: ["ignore", "inherit", "inherit"] });
  geometry = JSON.parse(
    execFileSync("java", ["-cp", classesDir, "com.omega.client.presence.GeometryDump"], { encoding: "utf-8" })
  );
} finally {
  fs.rmSync(classesDir, { recursive: true, force: true });
}

const gearQuads = geometry[kind];
const playerQuads = geometry.player;

// --- tiny orthographic projector (model space: y down, +z = player's back) ---
const toHex = (rgb) => "#" + rgb.toString(16).padStart(6, "0").toUpperCase();
const shadedCss = (rgb, shade) => {
  const r = Math.round(((rgb >> 16) & 0xff) * shade);
  const g = Math.round(((rgb >> 8) & 0xff) * shade);
  const b = Math.round((rgb & 0xff) * shade);
  return `rgb(${r},${g},${b})`;
};

function project(quads, yawDeg, pitchDeg, scale, cx, cy) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const polys = [];
  let maxArea = 1e-9;
  for (const quad of quads) {
    const pts = [];
    let depth = 0;
    for (let v = 0; v < 4; v++) {
      const X = quad.p[v * 3];
      const Y = -quad.p[v * 3 + 1]; // to y-up
      const Z = quad.p[v * 3 + 2];
      const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
      const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
      const y2 = Y * Math.cos(pitch) - z1 * Math.sin(pitch);
      const d = Y * Math.sin(pitch) + z1 * Math.cos(pitch);
      pts.push([cx + x1 * scale, cy - y2 * scale]);
      depth += d;
    }
    let area = 0;
    for (let v = 0; v < 4; v++) {
      const [ax, ay] = pts[v];
      const [bx, by] = pts[(v + 1) % 4];
      area += ax * by - bx * ay;
    }
    area = Math.abs(area) / 2;
    maxArea = Math.max(maxArea, area);
    polys.push({ pts, depth: depth / 4, area, quad });
  }
  // Painter's algorithm, far first (camera sits at +depth). Centroid depth alone misorders nested
  // near-coplanar detail (a hat band hugging the crown), so bias big faces slightly earlier -
  // small accents drawn on top of the large surface they sit against.
  polys.sort((a, b) => (a.depth - 0.05 * (a.area / maxArea)) - (b.depth - 0.05 * (b.area / maxArea)));
  return polys;
}

function svgView(label, yawDeg, pitchDeg) {
  const W = 260;
  const H = 330;
  const scale = 82; // px per model unit; player is ~2.6 units tall with gear margin
  const polys = project([...playerQuads, ...gearQuads], yawDeg, pitchDeg, scale, W / 2, H / 2 - 20);
  let shapes = "";
  for (const { pts, quad } of polys) {
    const fill =
      quad.rgb !== undefined
        ? shadedCss(quad.rgb, quad.shade)
        : shadedCss(quad.secondary ? secondary : primary, quad.shade);
    const d = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    shapes += `<polygon points="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.6"/>`;
  }
  return `<figure><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${shapes}</svg><figcaption>${label}</figcaption></figure>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #1b1b1b; color: #ddd; font-family: monospace; padding: 18px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .legend { font-size: 13px; color: #bbb; margin-bottom: 10px; }
  .swatch { display: inline-block; width: 13px; height: 13px; vertical-align: -2px; margin: 0 6px 0 14px; border: 1px solid #555; }
  .views { display: flex; gap: 14px; }
  figure { margin: 0; background: linear-gradient(#26262c, #17171a); border: 1px solid #333; }
  figcaption { text-align: center; font-size: 12px; color: #999; padding: 5px 0 7px; text-transform: uppercase; letter-spacing: 1px; }
</style></head><body>
  <h1>${kind} preview - real CosmeticGeometry quads</h1>
  <div class="legend">
    <span class="swatch" style="background:${toHex(primary)}"></span>primary ${toHex(primary)}
    <span class="swatch" style="background:${toHex(secondary)}"></span>secondary ${toHex(secondary)}
  </div>
  <div class="views">
    ${svgView("back ¾", 30, 12)}
    ${svgView("side", 90, 8)}
    ${svgView("front ¾", 210, 12)}
  </div>
</body></html>`;

const outFile = opts.out || path.join(process.env.SCREENSHOT_DIR || "/tmp/shots", `cosmetic-preview-${kind}.png`);
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
