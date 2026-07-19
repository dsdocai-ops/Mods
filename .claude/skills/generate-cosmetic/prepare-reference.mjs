#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Cleans up a real reference photo BEFORE it reaches pixelate.mjs or a TEXTURED candidate preview -
// the prep work that, done by hand, previously cost several rounds of guess-a-rotation-angle/
// screenshot/look/repeat (real credits burned on images that were only ever means to an end, not
// the deliverable). Everything here runs once, computed from the pixels themselves, no back-and-
// forth needed:
//
//   --deskew        Auto-corrects an off-angle photo of a flat rectangular thing (a phone screen, a
//                    printed image, anything shot not-quite-head-on): finds the content's dominant
//                    axis via image moments/PCA (the same technique document scanners use) and
//                    rotates it to vertical, then crops tight. One pass, no guessing. This corrects
//                    IN-PLANE ROTATION only, not true perspective/keystone (the camera not being
//                    exactly perpendicular to the subject) - for a photo with real keystone, the
//                    result may still show a sliver of background on one side after a large enough
//                    crop margin eats most of it; if it's still visibly off, look at the output ONCE
//                    and pass --angle <degrees> (see below) instead of re-running --deskew blindly.
//   --angle N        Skips auto-detection and rotates by exactly N degrees (same crop as --deskew) -
//                    the escape hatch for a photo --deskew's PCA doesn't nail (heavy keystone, or
//                    content whose brightness isn't evenly spread across the true rectangle, which
//                    biases the moment estimate). Implies --deskew.
//   --key-bg [LOW HIGH]   Keys a near-black background to transparent with a soft luminance ramp
//                    (LOW/HIGH default 26/46 - below LOW fully transparent, above HIGH fully
//                    opaque, ramped between) rather than a hard cutoff, so the cutout edge doesn't
//                    look jagged. Then crops tight to the now-opaque content. Use for a HAT/subject
//                    photo shot against a plain dark background before pixelate.mjs downsamples it
//                    (pixelate.mjs needs real alpha to cut the silhouette - a photo has none, and
//                    without keying the background gets treated as opaque and swallows the shape).
//   --fit W H        Fits the current image into a WxH canvas, preserving aspect ratio, transparent
//                    letterbox padding, centered. Use before pixelate.mjs when the source's aspect
//                    doesn't match the target kind's grid (e.g. a landscape crop going onto HAT's
//                    square-ish frame) - never stretch a silhouette photo, it distorts the shape.
//   --resize W H     Hard resize (stretches, no aspect preservation) to WxH. Use for a TEXTURED
//                    cape/hat candidate, which must land on an exact convention (100x160, matching
//                    CAPE_FRAME_WIDTH/HEIGHT x16 - see CosmeticTexturedMesh) - a modest stretch on a
//                    soft painterly gradient is imperceptible, unlike on a pixel-art silhouette.
//
// Flags compose in the order given above regardless of argument order (deskew/key-bg -> fit/resize),
// so e.g. a rotated photo of a dark-background subject can use both --deskew --key-bg in one run.
//
// Usage: node prepare-reference.mjs <image> [--deskew | --angle N] [--key-bg [LOW HIGH]] [--fit W H] [--resize W H] [--out file.png]
// Any format Chromium decodes (png/jpg/webp/gif/bmp/svg/avif) in; always PNG out (needs alpha).

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".bmp": "image/bmp", ".svg": "image/svg+xml", ".avif": "image/avif",
};

const args = process.argv.slice(2);
let image = "";
const opts = { deskew: false, angle: null, keyBg: false, keyLow: 26, keyHigh: 46, fitW: 0, fitH: 0, resizeW: 0, resizeH: 0, out: "" };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--deskew") opts.deskew = true;
  else if (a === "--angle") { opts.deskew = true; opts.angle = parseFloat(args[++i]); }
  else if (a === "--key-bg") {
    opts.keyBg = true;
    // Optional LOW HIGH pair - only consume them if both are actually numbers, so a bare --key-bg
    // followed by another flag or the image path doesn't get misread as thresholds.
    if (args[i + 1] !== undefined && args[i + 2] !== undefined && /^\d+$/.test(args[i + 1]) && /^\d+$/.test(args[i + 2])) {
      opts.keyLow = parseInt(args[++i], 10);
      opts.keyHigh = parseInt(args[++i], 10);
    }
  } else if (a === "--fit") { opts.fitW = parseInt(args[++i], 10); opts.fitH = parseInt(args[++i], 10); }
  else if (a === "--resize") { opts.resizeW = parseInt(args[++i], 10); opts.resizeH = parseInt(args[++i], 10); }
  else if (a === "--out") opts.out = args[++i];
  else if (!a.startsWith("--")) image = a;
}

const mime = image ? MIME[path.extname(image).toLowerCase()] : null;
if (!image || !mime || (!opts.deskew && !opts.keyBg && !opts.fitW && !opts.resizeW)) {
  console.error("Usage: node prepare-reference.mjs <image> [--deskew | --angle N] [--key-bg [LOW HIGH]] [--fit W H] [--resize W H] [--out file.png]");
  console.error("At least one of --deskew / --key-bg / --fit / --resize is required.");
  process.exit(1);
}

const dataUrl = `data:${mime};base64,${fs.readFileSync(image).toString("base64")}`;

const browser = await chromium.launch();
let resultUrl;
try {
  const page = await browser.newPage();
  resultUrl = await page.evaluate(async ({ src, opts }) => {
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Chromium could not decode the image"));
        img.src = url;
      });
    }
    function canvasFrom(img) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      return c;
    }
    function contentBBox(canvas, alphaAware) {
      const ctx = canvas.getContext("2d");
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const present = alphaAware ? d[i + 3] > 8 : (d[i] + d[i + 1] + d[i + 2]) / 3 > 20;
          if (!present) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      return maxX < 0 ? null : { minX, minY, maxX, maxY };
    }

    // --- deskew: principal-axis (image-moments) angle correction, then crop to content ---
    // Finds the correction angle from the SHAPE of the content mass itself: threshold to content
    // pixels, then the eigenvector of their (x,y) covariance matrix with the larger eigenvalue is
    // the content's dominant axis (its long side, for a portrait rectangle) - rotating that axis to
    // vertical straightens the photo. This is the standard document-deskew trick (image moments/
    // PCA), and it's far more robust than hunting for the rotation that minimizes the axis-aligned
    // bounding box: a bounding-box search gets thrown off by a single stray bright pixel (JPEG
    // noise, a reflection) sitting at a corner, since that ONE pixel alone can pin the box at any
    // angle and hide the real signal: PCA instead averages over every content pixel's position, so
    // a few outliers barely move the estimate. One pass over the pixels, one rotation - no search,
    // no rendering candidates for a human to look at.
    //
    // KNOWN LIMITATION (see the file header's --angle escape hatch): this assumes content density
    // is roughly even across the true rectangle. A painterly scene where brightness itself carries
    // most of the composition (a dark sky at one end, a bright horizon at the other) skews the mass
    // toward the bright end and can bias the estimate - if the output still looks tilted, that's
    // this, not a bug to keep chasing; look once and supply --angle instead of re-tuning the
    // threshold or re-running blindly (been there - see git history on this file).
    function deskew(canvas, manualAngle) {
      const ctx = canvas.getContext("2d");
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const THRESH = 35;
      let n = 0, sx = 0, sy = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if ((d[i] + d[i + 1] + d[i + 2]) / 3 > THRESH) { n++; sx += x; sy += y; }
        }
      }
      if (n < 4 && manualAngle == null) return canvas; // nothing to key off of - leave as-is rather than guess
      const cx = sx / n, cy = sy / n;
      let sxx = 0, syy = 0, sxy = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if ((d[i] + d[i + 1] + d[i + 2]) / 3 <= THRESH) continue;
          const dx = x - cx, dy = y - cy;
          sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
        }
      }
      let correction;
      if (manualAngle != null) {
        correction = manualAngle;
      } else {
        sxx /= n; syy /= n; sxy /= n;
        const axisDeg = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI; // dominant axis, degrees from +x
        // Bring the dominant axis to vertical (content here is always portrait - CAPE_FRAME's own
        // 10:16 aspect is portrait too): the nearest of +90/-90 is always within 90 degrees of axisDeg.
        correction = 90 - axisDeg;
        while (correction > 90) correction -= 180;
        while (correction <= -90) correction += 180;
      }

      const scale = 4; // upsample so sub-degree rotation doesn't lose content to integer rounding
      const pad = Math.ceil(Math.max(canvas.width, canvas.height) * scale * 0.5);
      const bigW = canvas.width * scale + pad * 2, bigH = canvas.height * scale + pad * 2;
      const trial = document.createElement("canvas");
      trial.width = bigW; trial.height = bigH;
      const tctx = trial.getContext("2d");
      tctx.save();
      tctx.translate(bigW / 2, bigH / 2);
      tctx.rotate((correction * Math.PI) / 180);
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(canvas, -canvas.width * scale / 2, -canvas.height * scale / 2, canvas.width * scale, canvas.height * scale);
      tctx.restore();
      const bbox = contentBBox(trial, false);
      if (!bbox) return canvas;
      // Crop tight with a small inward margin to shed the antialiased/bezel fringe a hard content
      // threshold leaves at the true edge - and, for a photographed (not scanned) rectangle, any
      // residual keystone a pure rotation can't fully correct (see the class doc: PCA finds
      // rotation, not full perspective). Sized relative to the CONTENT's own bbox, not the padded
      // working canvas - the padding is sized for the source image, which can be much larger than
      // the actual subject once rotated (a small subject on a big frame would otherwise lose most
      // or all of itself to a margin computed off the wrong denominator).
      const margin = Math.round(Math.min(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.08);
      const x0 = bbox.minX + margin, y0 = bbox.minY + margin;
      const w = Math.max(1, bbox.maxX - margin - x0), h = Math.max(1, bbox.maxY - margin - y0);
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      out.getContext("2d").drawImage(trial, x0, y0, w, h, 0, 0, w, h);
      return out;
    }

    // --- key-bg: soft luminance-ramp alpha key, then crop to the now-opaque content ---
    function keyBg(canvas, low, high) {
      const ctx = canvas.getContext("2d");
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = idata.data;
      for (let p = 0; p < d.length; p += 4) {
        const lum = (d[p] + d[p + 1] + d[p + 2]) / 3;
        let a = 255;
        if (lum <= low) a = 0;
        else if (lum < high) a = Math.round(((lum - low) / (high - low)) * 255);
        d[p + 3] = a;
      }
      ctx.putImageData(idata, 0, 0);
      const bbox = contentBBox(canvas, true);
      if (!bbox) return canvas;
      const margin = 3;
      const x0 = Math.max(0, bbox.minX - margin), y0 = Math.max(0, bbox.minY - margin);
      const w = Math.min(canvas.width, bbox.maxX + margin) - x0, h = Math.min(canvas.height, bbox.maxY + margin) - y0;
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      out.getContext("2d").drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
      return out;
    }

    function fit(canvas, W, H) {
      const scale = Math.min(W / canvas.width, H / canvas.height);
      const dw = canvas.width * scale, dh = canvas.height * scale;
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      const out = document.createElement("canvas");
      out.width = W; out.height = H;
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = true;
      octx.drawImage(canvas, dx, dy, dw, dh);
      return out;
    }

    function resize(canvas, W, H) {
      const out = document.createElement("canvas");
      out.width = W; out.height = H;
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(canvas, 0, 0, W, H);
      return out;
    }

    let canvas = canvasFrom(await loadImage(src));
    if (opts.deskew) canvas = deskew(canvas, opts.angle);
    if (opts.keyBg) canvas = keyBg(canvas, opts.keyLow, opts.keyHigh);
    if (opts.fitW) canvas = fit(canvas, opts.fitW, opts.fitH);
    if (opts.resizeW) canvas = resize(canvas, opts.resizeW, opts.resizeH);
    return canvas.toDataURL("image/png");
  }, { src: dataUrl, opts });
} finally {
  await browser.close();
}

const outFile = opts.out || image.replace(/\.[^.]+$/, "") + ".prepared.png";
fs.writeFileSync(outFile, Buffer.from(resultUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
console.log(outFile);
