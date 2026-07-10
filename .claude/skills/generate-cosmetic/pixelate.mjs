#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Turns a reference image into cosmetic pixel art: downsamples it onto a kind-sized grid (dominant
// color per cell, alpha-aware so transparent regions cut the silhouette), quantizes to a small
// palette, and prints the art in CosmeticPixelArt's text format - both raw (for preview-cosmetic.mjs
// --art) and as a ready-to-paste Java text block for CosmeticPixelArt.java. Decoding runs through
// Playwright Chromium's canvas, same as extract-colors.mjs - anything Chromium renders works.
//
// Usage: node .claude/skills/generate-cosmetic/pixelate.mjs <image> --kind hat|cape|wings
//          [--width N --height N] [--colors N] [--out art.txt]
//
// Canonical grids (the frames CosmeticGeometry stretches art into): hat 14x9, cape 10x16,
// wings 12x10 (right wing; the mod mirrors the left). Other sizes render fine - the frame
// stretches - but stray far and pixels go non-square.
//
// The machine mapping is a starting point: expect to hand-tune rows afterward (see SKILL.md) -
// good pixel art is edited, not just downsampled.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const GRIDS = { hat: [14, 9], cape: [10, 16], wings: [12, 10] };
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".bmp": "image/bmp", ".svg": "image/svg+xml", ".avif": "image/avif",
};

const args = process.argv.slice(2);
let image = "";
const opts = { kind: "", width: "", height: "", colors: "6", out: "" };
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    if (key in opts) opts[key] = args[++i] ?? "";
  } else {
    image = args[i];
  }
}

const grid = GRIDS[opts.kind.toLowerCase()];
const W = parseInt(opts.width, 10) || grid?.[0];
const H = parseInt(opts.height, 10) || grid?.[1];
const maxColors = Math.min(Math.max(parseInt(opts.colors, 10) || 6, 2), 20);
const mime = MIME[path.extname(image).toLowerCase()];
if (!image || !W || !H || !mime) {
  console.error("Usage: node pixelate.mjs <image> --kind hat|cape|wings [--width N --height N] [--colors N] [--out art.txt]");
  process.exit(1);
}

const dataUrl = `data:${mime};base64,${fs.readFileSync(image).toString("base64")}`;

const browser = await chromium.launch();
let cells;
try {
  const page = await browser.newPage();
  cells = await page.evaluate(async ({ src, W, H }) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Chromium could not decode this image"));
      img.src = src;
    });
    const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(W, Math.round(img.naturalWidth * scale));
    const h = Math.max(H, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;

    // Dominant color per grid cell (quantized 5-bit bins, true mean per bin); a cell under 40%
    // opaque becomes transparent, so an image's alpha cuts the cosmetic's silhouette.
    const out = [];
    for (let gy = 0; gy < H; gy++) {
      for (let gx = 0; gx < W; gx++) {
        const x0 = Math.floor((gx * w) / W), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / W));
        const y0 = Math.floor((gy * h) / H), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / H));
        const bins = new Map();
        let opaque = 0, total = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            total++;
            const i = (y * w + x) * 4;
            if (d[i + 3] < 128) continue;
            opaque++;
            const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
            let bin = bins.get(key);
            if (!bin) bins.set(key, (bin = { c: 0, r: 0, g: 0, b: 0 }));
            bin.c++; bin.r += d[i]; bin.g += d[i + 1]; bin.b += d[i + 2];
          }
        }
        if (opaque / total < 0.4) {
          out.push(-1);
        } else {
          let best = null;
          for (const bin of bins.values()) if (!best || bin.c > best.c) best = bin;
          out.push(
            ((Math.round(best.r / best.c) & 0xff) << 16) |
            ((Math.round(best.g / best.c) & 0xff) << 8) |
            (Math.round(best.b / best.c) & 0xff)
          );
        }
      }
    }
    return out;
  }, { src: dataUrl, W, H });
} finally {
  await browser.close();
}

// Quantize to <= maxColors by merging the closest pair until small enough (cell counts are tiny).
const counts = new Map();
for (const rgb of cells) if (rgb >= 0) counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
if (counts.size === 0) {
  console.error("Every cell came out transparent - the image has no opaque area at this grid size.");
  process.exit(1);
}
const channels = (rgb) => [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
const dist = (a, b) => {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
};
const remap = new Map();
let palette = [...counts.entries()].map(([rgb, count]) => ({ rgb, count }));
while (palette.length > maxColors) {
  let bi = 0, bj = 1, bd = Infinity;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const dd = dist(palette[i].rgb, palette[j].rgb);
      if (dd < bd) { bd = dd; bi = i; bj = j; }
    }
  }
  const a = palette[bi], b = palette[bj];
  const total = a.count + b.count;
  const merged = {
    rgb:
      ((Math.round((channels(a.rgb)[0] * a.count + channels(b.rgb)[0] * b.count) / total) & 0xff) << 16) |
      ((Math.round((channels(a.rgb)[1] * a.count + channels(b.rgb)[1] * b.count) / total) & 0xff) << 8) |
      (Math.round((channels(a.rgb)[2] * a.count + channels(b.rgb)[2] * b.count) / total) & 0xff),
    count: total,
  };
  remap.set(a.rgb, merged.rgb);
  remap.set(b.rgb, merged.rgb);
  palette.splice(bj, 1);
  palette.splice(bi, 1, merged);
}
const resolve = (rgb) => {
  while (remap.has(rgb) && remap.get(rgb) !== rgb) rgb = remap.get(rgb);
  return rgb;
};

// Letters by frequency; rows in CosmeticPixelArt's text format.
palette.sort((a, b) => b.count - a.count);
const letters = "abcdefghijklmnopqrst";
const keyOf = new Map(palette.map((entry, i) => [entry.rgb, letters[i]]));
const toHex = (rgb) => rgb.toString(16).padStart(6, "0").toUpperCase();

const paletteLines = palette.map((entry) => `${keyOf.get(entry.rgb)}=${toHex(entry.rgb)}`);
const rowLines = [];
for (let y = 0; y < H; y++) {
  let row = "";
  for (let x = 0; x < W; x++) {
    const rgb = cells[y * W + x];
    row += rgb < 0 ? "." : keyOf.get(resolve(rgb));
  }
  rowLines.push(row);
}
const art = [...paletteLines, ...rowLines].join("\n");

if (opts.out) {
  fs.writeFileSync(opts.out, art + "\n");
  console.log(`# written to ${opts.out}`);
}
console.log("# art (CosmeticPixelArt text format - preview with: preview-cosmetic.mjs --art <file> --kind " + (opts.kind || "<kind>") + ")");
console.log(art);
console.log("\n# Java text block for CosmeticPixelArt.java:");
console.log('    public static final PixelArt NEW_ART = parse("""');
for (const line of [...paletteLines, ...rowLines]) console.log(`            ${line}`);
console.log('            """);');
