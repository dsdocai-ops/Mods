---
name: run-omega-client
description: Build, run, and drive the Omega Client Electron launcher (repo root). Use when asked to start the launcher, screenshot its UI, take screenshots of its tabs/Settings/New Instance dialog, click a feature toggle, or verify a renderer change actually renders/reacts correctly.
---

The real Electron binary cannot launch in this environment (network-blocked
binary download - see Gotchas), so this drives the built renderer as a plain
web page in Playwright's Chromium, with `window.api` (the IPC surface from
`src/main/preload.ts`) replaced by a mock matching the real main-process
handlers in `src/main/*.ts`. Drive it via
`.claude/skills/run-omega-client/driver.mjs` - no xvfb needed, Chromium runs
headless.

**Scope**: this verifies the React renderer's rendering/event-handling logic
and the IPC *contract shapes* (does a click call the right `window.api`
method with the right payload). It does NOT execute real Electron
main-process code - no real file I/O, Java launching, installer downloads,
or Microsoft OAuth. Treat it as a renderer smoke test, not a full
integration test.

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
```

No unit test suite exists for the renderer/main process. `mod/` (the
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
