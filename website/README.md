<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->
# Omega Client website

The public marketing site for Omega Client: plain static HTML/CSS/JS, no build
step, no framework, no external requests (fonts and icons are system/emoji, all
assets live in `assets/`).

## Pages

| File | What it is |
|---|---|
| `index.html` | Landing page - hero, launcher highlights, built-in mod grid, presets, download CTA |
| `features.html` | Full feature breakdown - launcher grid, the companion mod's feature table, keybinds |
| `download.html` | Per-platform downloads (OS auto-highlighted), standalone mod jars, getting-started steps |
| `faq.html` | Frequently asked questions |
| `404.html` | Not-found page (GitHub Pages picks this up automatically) |

Screenshots in `assets/img/` are real captures of the launcher renderer, taken
with `.claude/skills/run-omega-client/driver.mjs` (see that skill's README) -
re-capture and replace them after any launcher UI redesign.

Download links point at the rolling
[`latest-build` release](https://github.com/dsdocai-ops/Mods/releases/tag/latest-build),
so they never go stale; exact artifact names (`OmegaClient-Setup.exe`,
`OmegaClient-arm64.dmg`, `OmegaClient-x86_64.AppImage`, the mod jars) must
match what CI publishes - if `package.json`'s `build.*.artifactName` values
change, update `download.html` and `assets/js/main.js` to match.

## Preview locally

Any static server works:

```bash
npx serve website
# or
python3 -m http.server 8000 --directory website
```

## Deploying

`.github/workflows/pages.yml` publishes `website/` to GitHub Pages on every
push to `main` that touches it. One-time setup: repo **Settings → Pages →
Source: GitHub Actions**. The site is plain static files, so any other host
(Netlify, Cloudflare Pages, an S3 bucket) works by pointing it at this
directory unchanged.
