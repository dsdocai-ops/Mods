#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
//
// Renders candidate badge colors as they'll actually appear in-game: an "Ω PlayerName" nametag -
// white name, colored Ω prefix, vanilla's rgba(0,0,0,0.25) translucent plate (the exact rendering
// EntityRendererMixin produces) - against three world backdrops (day sky, dusk, cave), because the
// plate is see-through and a color that pops at noon can vanish underground. Screenshot goes to
// $SCREENSHOT_DIR (default /tmp/shots) for review before the color is committed to CosmeticCatalog.
//
// Usage: node .claude/skills/generate-cosmetic/preview-badge.mjs <color> [<color> ...] [--name Steve] [--out <file.png>]
//   <color>  #RRGGBB, RRGGBB, or Java-style 0xRRGGBB
//
// The current default red (0xE63946, the "no cosmetic" badge) is always rendered as the first row
// so every candidate is judged next to what players already see.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_BADGE = "#E63946"; // CosmeticCatalog.DEFAULT_BADGE_RGB

const args = process.argv.slice(2);
const colors = [];
let name = "Steve";
let out = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name") name = args[++i] ?? name;
  else if (args[i] === "--out") out = args[++i] ?? out;
  else colors.push(args[i]);
}

function normalize(input) {
  const m = /^(?:#|0x)?([0-9a-fA-F]{6})$/.exec(input.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

if (colors.length === 0) {
  console.error("Usage: node .claude/skills/generate-cosmetic/preview-badge.mjs <#RRGGBB|0xRRGGBB> [...] [--name Steve] [--out file.png]");
  process.exit(1);
}
const normalized = colors.map((c) => {
  const hex = normalize(c);
  if (!hex) {
    console.error(`Not a color: "${c}" (expected #RRGGBB, RRGGBB, or 0xRRGGBB)`);
    process.exit(1);
  }
  return hex;
});

const rows = [{ hex: DEFAULT_BADGE, label: `${DEFAULT_BADGE} (current default - no cosmetic)` }]
  .concat(normalized.map((hex) => ({ hex, label: `${hex} (candidate)` })));

const backdrops = [
  { label: "day", css: "linear-gradient(#7fb8e8, #a8d5f2 70%, #6a9e58 70%, #588a49)" },
  { label: "dusk", css: "linear-gradient(#2c2440, #6d3a55 65%, #3a3328 65%, #2b2620)" },
  { label: "cave", css: "linear-gradient(#141414, #0a0a0a)" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #1b1b1b; font-family: monospace; }
  table { border-collapse: collapse; }
  th { color: #bbb; font: 14px monospace; padding: 10px 6px 4px; text-transform: uppercase; letter-spacing: 1px; }
  td.scene { width: 280px; height: 84px; text-align: center; vertical-align: middle; }
  td.label { color: #ddd; font: 14px monospace; padding: 0 16px; white-space: nowrap; }
  .swatch { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 8px; border: 1px solid #555; }
  .tag { display: inline-block; background: rgba(0, 0, 0, 0.25); padding: 5px 10px 4px; font: 22px monospace; color: #fff; }
</style></head><body><table>
  <tr><th></th>${backdrops.map((b) => `<th>${b.label}</th>`).join("")}</tr>
  ${rows
    .map(
      (row) => `<tr>
    <td class="label"><span class="swatch" style="background:${row.hex}"></span>${esc(row.label)}</td>
    ${backdrops
      .map(
        (b) => `<td class="scene" style="background:${b.css}">
      <span class="tag"><span style="color:${row.hex}">Ω </span>${esc(name)}</span>
    </td>`
      )
      .join("")}
  </tr>`
    )
    .join("")}
</table></body></html>`;

const outFile = out || path.join(process.env.SCREENSHOT_DIR || "/tmp/shots", "badge-preview.png");
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
