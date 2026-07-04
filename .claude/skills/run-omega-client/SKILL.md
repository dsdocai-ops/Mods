---
name: run-omega-client
description: Build, run, and drive the Omega Client Electron launcher (repo root). Use when asked to start the launcher, screenshot its UI, take screenshots of its tabs/Settings/New Instance dialog, click a feature toggle, verify a renderer change actually renders/reacts correctly, or exercise the real main-process logic (instance CRUD, Java detection, mod-jar metadata parsing) directly.
---

<!-- "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13). -->

The real Electron binary cannot launch in this environment (network-blocked
binary download - see Gotchas), so this ships two complementary drivers:

1. **`driver.mjs`** - drives the built renderer as a plain web page in
   Playwright's Chromium, with `window.api` (the IPC surface from
   `src/main/preload.ts`) replaced by a mock matching the real main-process
   handlers. Verifies the React UI's rendering/event-handling and the IPC
   *contract shapes* - not real main-process code. No xvfb needed, Chromium
   runs headless.
2. **`main-process-smoke.cjs`** - calls the REAL compiled `src/main/*.ts`
   functions directly (instance CRUD, Java detection, mod-jar metadata
   parsing) against real files on disk - no mocking of this code at all,
   only the one `electron.app.getPath()` call these modules need is stubbed.
   This is the one that actually exercises production logic; `driver.mjs`
   only exercises the UI around a stand-in for it.

Between the two: `driver.mjs` covers the renderer, `main-process-smoke.cjs`
covers everything in `src/main/*.ts` that doesn't import `electron` beyond
`app.getPath`. Still never exercised by either: the installer's network
download engine, and the Microsoft OAuth flow (both need real external
network access this environment may not allow - not yet checked).

All paths below are relative to the repo root (`/home/user/Mods` in this
container).

## Prerequisites

None beyond Node - no `apt-get` packages needed (no xvfb, since Chromium
runs headless and there's no real Electron window to virtualize).

`playwright` must be a project devDependency (already is - installed via
`npm install -D playwright@1.56.1`). Its Chromium browser binary comes from
the environment's pre-provisioned `/opt/pw-browsers`
(`PLAYWRIGHT_BROWSERS_PATH` + `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` are
already set - `npm install` does NOT re-download a browser).

## Build

```bash
npm install          # if node_modules/ is missing
npm run build:renderer   # builds dist-renderer/ - the only thing the driver serves
```

(`npm run build:electron` / `npm run build` also work but are irrelevant
here - the driver never touches `dist-electron/`, since the real Electron
main process never runs.)

## Run (agent path)

```bash
node .claude/skills/run-omega-client/driver.mjs
```

Wrap in tmux for interactive use (poll for the `driver>` prompt / a command's
own output marker instead of a fixed sleep):

```bash
tmux new-session -d -s omega -x 200 -y 50
tmux send-keys -t omega 'node .claude/skills/run-omega-client/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t omega -p | grep -q "driver>"; do sleep 0.3; done'
tmux send-keys -t omega 'launch' Enter
timeout 20 bash -c 'until tmux capture-pane -t omega -p | grep -qE "launched\.|ERROR"; do sleep 0.3; done'
tmux send-keys -t omega 'ss landing' Enter
tmux capture-pane -t omega -p
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`).

### Commands

| command | what it does |
|---|---|
| `launch` | serves `dist-renderer/` on :4173, opens Chromium, injects the `window.api` mock, navigates |
| `ss [name]` | screenshot (full page) -> `$SCREENSHOT_DIR/<name>.png` |
| `click <css-sel>` | click element via DOM `.click()` |
| `click-text <text>` | click the button/link/tab whose text matches (exact, falling back to substring) |
| `toggle-checkbox <label text>` | clicks the checkbox inside the `<label>` containing that text (the app's Features/Particles/etc. toggle-row pattern) |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait up to 10s for a selector |
| `eval <js>` | evaluate an expression in the page, print JSON |
| `text [css-sel]` | print `innerText` (body if no selector) |
| `calls` | print everything the app called on the mocked `window.api` (`launch`, `update`, `write` arrays) - use this to confirm a click invoked the right IPC method with the right payload |
| `quit` | close the browser, stop the static server, exit |

Every screen you can reach this way: the default Features tab, Mods, Shaders,
Console, Instance Settings (all five instance tabs), the global Settings
page (`click-text Settings`), and the New Instance modal
(`click-text "+ New Instance"`).

## Direct invocation (real main-process code, no mock)

```bash
npm run build:electron   # compiles src/main/*.ts -> dist-electron/main/*.js (CommonJS)
node .claude/skills/run-omega-client/main-process-smoke.cjs
```

Runs ~20 checks against the REAL compiled functions - not a mock of them:
`instances.ts`/`store.ts` (create/list/update/remove an instance, confirmed
by reading the actual `launcher-store.json` back off disk), `java.ts`
(`detectJavaCandidates()` against this container's real installed JDK,
`verifyJava()` spawning the real `java -version`), and `mods.ts`/
`modMetadata.ts` (builds two real jars with `adm-zip` - one with a genuine
`fabric.mod.json`, one with a genuine `META-INF/mods.toml` - then lists,
toggles, and tag-presets them for real). Prints `OK`/`FAIL` per check, exits
non-zero if anything failed, cleans up its own scratch directory either way.

The only thing stubbed is `electron`'s `app.getPath("userData")` (these
modules' one and only touchpoint with the `electron` package) - everything
downstream of that call is the unmodified compiled output of `src/main/*.ts`.
Modules that need more of `electron` than `app.getPath` (`accountStore.ts`,
`bundledMods.ts`, `main.ts`, `msAuth.ts`, `updater.ts` - anything using
`BrowserWindow`, `safeStorage`, `ipcMain`, or `shell` for real) are out of
scope for this technique; extend the `Module._load` stub in
`main-process-smoke.cjs` if you need to reach one of those.

## Run (human path)

```bash
npm run dev   # opens a real Electron window - useless headless, and the
              # real electron binary isn't downloadable in this environment
              # anyway (see Gotchas). Works on a normal dev machine with
              # network access.
```

## Test

```bash
npm run typecheck   # tsc --noEmit on both the renderer and electron-main tsconfigs
npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs   # see Direct invocation above
```

No conventional unit test suite exists for the renderer/main process -
`main-process-smoke.cjs` above is the closest thing to one. `mod/` (the
companion Java mod) has its own CI-only verification - see `mod/README.md`.

---

## Gotchas

- **The real Electron binary cannot launch here.** `node_modules/electron/dist/electron`
  doesn't exist after `npm install` - electron's postinstall downloads a
  prebuilt binary from GitHub releases, and this environment's network
  policy returns `403 Forbidden` for that host (same restriction that blocks
  the `mod/` Java side's Minecraft/Fabric/Forge Maven dependencies). No
  system-wide Electron binary exists as a fallback either. This is why the
  driver serves the renderer as a plain web page instead of using
  Playwright's `_electron` API - there is no Electron process to attach to.

- **Guessing a mock's return shape produces false-positive React crashes.**
  `preload.ts`'s IPC methods are effectively untyped on the return side
  (`ipcRenderer.invoke(...)` resolves to `Promise<any>`), so nothing catches
  a mismatch except reading both sides. Hit this for real:
  `java.detect()` mocked as `[{path, version, major}]` crashed the whole app
  with React error #31 ("objects are not valid as a React child") the
  moment the Settings page tried `javaCandidates.map(path => <option>{path}</option>)`
  - the real `detectJavaCandidates()` in `src/main/java.ts` returns plain
  `string[]`. **Before changing any mock return shape in `driver.mjs`, grep
  `src/main/main.ts`'s `ipcMain.handle(...)` calls and read the real handler
  in `src/main/*.ts`.**

- **The mock must cover every `window.api.*` method preload.ts exposes**,
  not just the ones your change touches. `App.tsx` and several pages call
  multiple channels unconditionally on mount (`instances.list`,
  `settings.get`, `java.detect`, `accounts.list`, ...) - a partial mock
  throws on the very first missing method before you get anywhere.

- **`window.addInitScript` must run before `page.goto`**, not after - the
  app calls `window.api.*` synchronously during React's initial mount, so
  injecting the mock after navigation is too late (everything crashes on
  `window.api is undefined`).

- **`dist-electron/main/*.js` is CommonJS** (`tsconfig.electron.json`
  targets it that way), which is what makes the `Module._load` patch in
  `main-process-smoke.cjs` work - `require("electron")` inside those
  compiled files goes through Node's normal CJS resolution, so intercepting
  `Module._load` before requiring them redirects it cleanly. This would NOT
  work against an ESM build (no `Module._load` hook for `import`).

- **Build real jars for metadata-parsing tests, don't hand-roll JSON
  strings.** `modMetadata.ts` opens each jar as an actual zip via `AdmZip`
  (already a project dependency) and looks for specific entry paths
  (`fabric.mod.json`, `META-INF/mods.toml`, etc.) - the only way to
  genuinely exercise that code is a real zip with those entries, which
  `AdmZip`'s own writer API builds in a few lines. A fake in-memory object
  standing in for "a jar" would test nothing about the actual zip-reading path.

- **Setting a controlled `<input>`'s `.value` directly in `eval` doesn't
  register with React.** React wraps the native value setter, so
  `el.value = 'x'` followed by `el.dispatchEvent(new Event('input'))`
  leaves React's own state untouched (the app still sees the old/empty
  value, e.g. a Redeem button stays disabled because `licenseKey.trim()`
  is empty in state even though the DOM shows text). Go through the native
  property descriptor's setter first, then dispatch: `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, 'x'); el.dispatchEvent(new Event('input', {bubbles: true}))`.
  Simpler alternative when the element already has focus: use the driver's
  `type` command (real keyboard events), which doesn't have this problem.

- **The `eval` command's expression must invoke itself.**
  `page.evaluate(expr)` evaluates `expr` as-is - passing a bare arrow
  function string like `() => document.title` returns the function itself
  (prints as `null`/`undefined` through JSON), it does NOT call it. Wrap in
  an IIFE: `eval (() => document.title)()`.

## Troubleshooting

- **`ERROR: .../dist-renderer missing - run "npm run build:renderer" first`**:
  exactly what it says - the driver only serves the built output, it doesn't
  run Vite itself.
- **`Executable doesn't exist at .../chromium...`**: `PLAYWRIGHT_BROWSERS_PATH`
  isn't pointing at the pre-provisioned browsers, or `playwright` isn't
  installed as a devDependency. Check `echo $PLAYWRIGHT_BROWSERS_PATH` (should
  be `/opt/pw-browsers`) and `npm ls playwright`.
- **A `click-text`/`toggle-checkbox` returns `NOT_FOUND`**: the tab/label
  text has to match exactly what's rendered - use `text` (no selector) to
  dump the page's visible text first and copy the exact label.
