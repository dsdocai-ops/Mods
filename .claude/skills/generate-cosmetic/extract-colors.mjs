#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Extracts a color palette from reference image(s) so a new cosmetic badge color can be derived
// from art instead of guessed. Decodes via Playwright Chromium's canvas (same pre-provisioned
// browser the run-omega-client skill uses - no image-decoding npm dependency needed), so anything
// Chromium renders works: png, jpg, webp, gif, bmp, svg, avif.
//
// Usage: node .claude/skills/generate-cosmetic/extract-colors.mjs <image> [<image> ...]
//
// Prints one JSON object per image:
//   average        - mean of all opaque pixels (muddy for multi-colored art; prefer the palette)
//   palette        - top quantized colors by pixel share, with per-color HSL
//   suggestedBadge - the most vibrant prominent color, lightness-lifted into the range that stays
//                    readable on Minecraft's translucent-dark nametag background (see SKILL.md).
//                    A starting point, not a verdict - always confirm with preview-badge.mjs.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node .claude/skills/generate-cosmetic/extract-colors.mjs <image> [<image> ...]");
  process.exit(1);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

const toHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

/**
 * Vanilla nametags draw white text over rgba(0,0,0,0.25) floating in the world, so a badge color
 * needs real lightness to read at a glance. Keeps hue/saturation, clamps lightness into a legible
 * band instead of rejecting dark-but-on-brand palette picks outright.
 */
function liftForNametag({ r, g, b }) {
  const { h, s, l } = rgbToHsl(r, g, b);
  const lifted = Math.min(Math.max(l, 0.5), 0.78);
  return lifted === l ? { r, g, b } : hslToRgb(h, s, lifted);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];

try {
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
      results.push({ file, error: `unsupported extension "${ext}" (known: ${Object.keys(MIME).join(" ")})` });
      continue;
    }
    let dataUrl;
    try {
      dataUrl = `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
    } catch (err) {
      results.push({ file, error: String(err.message ?? err) });
      continue;
    }

    const raw = await page.evaluate(async (src) => {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Chromium could not decode this image"));
        img.src = src;
      });
      // Downscale huge inputs - palette extraction doesn't need more than ~64k samples.
      const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;

      // 4-bits-per-channel histogram; each bin remembers its true mean so quantization only
      // groups pixels, it doesn't posterize the reported color.
      const bins = new Map();
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue; // transparent background isn't part of the art
        const r = d[i], g = d[i + 1], b = d[i + 2];
        n++; sr += r; sg += g; sb += b;
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        let bin = bins.get(key);
        if (!bin) bins.set(key, (bin = { c: 0, r: 0, g: 0, b: 0 }));
        bin.c++; bin.r += r; bin.g += g; bin.b += b;
      }
      if (n === 0) return null;
      const top = [...bins.values()]
        .sort((a, b) => b.c - a.c)
        .slice(0, 24)
        .map((bin) => ({
          count: bin.c,
          r: Math.round(bin.r / bin.c),
          g: Math.round(bin.g / bin.c),
          b: Math.round(bin.b / bin.c),
        }));
      return {
        total: n,
        average: { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) },
        top,
      };
    }, dataUrl).catch((err) => ({ error: String(err.message ?? err) }));

    if (!raw || raw.error) {
      results.push({ file, error: raw?.error ?? "image is fully transparent - no opaque pixels to sample" });
      continue;
    }

    const palette = raw.top.map((bin) => {
      const { h, s, l } = rgbToHsl(bin.r, bin.g, bin.b);
      return {
        hex: toHex(bin),
        share: +(bin.count / raw.total).toFixed(4),
        hsl: { h: Math.round(h * 360), s: +s.toFixed(2), l: +l.toFixed(2) },
      };
    });

    // Most vibrant prominent color: weight pixel share (sub-linearly, so an accent color can beat
    // a giant flat background) by saturation, and taper colors too dark/light to ever read well.
    let best = null;
    for (const bin of raw.top) {
      const share = bin.count / raw.total;
      if (share < 0.01) continue;
      const { s, l } = rgbToHsl(bin.r, bin.g, bin.b);
      const legibility = 1 - Math.min(1, Math.abs(l - 0.55) / 0.55);
      const score = Math.sqrt(share) * (0.15 + s) * (0.35 + legibility);
      if (!best || score > best.score) best = { score, bin };
    }
    const pick = best ? best.bin : raw.average;

    results.push({
      file,
      average: toHex(raw.average),
      palette: palette.slice(0, 8),
      suggestedBadge: toHex(liftForNametag(pick)),
      suggestedBadgeSource: toHex(pick),
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.error)) process.exit(1);
