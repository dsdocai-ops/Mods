// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// REPL driver for the Omega Client Electron launcher's renderer.
//
// The real Electron binary cannot launch in this environment (network-
// blocked download of the prebuilt binary - see SKILL.md Gotchas), so this
// drives the built renderer as a plain web page in Playwright's
// pre-installed Chromium, with `window.api` (the contextBridge IPC surface
// from src/main/preload.ts) replaced by a mock that matches the real
// main-process handlers' return shapes (src/main/*.ts). This verifies the
// React UI's rendering/event-handling logic and the IPC *contract shapes* -
// it does NOT execute any real Electron main-process code (file I/O, Java
// launching, installers, OAuth). See SKILL.md for the full scope caveat.
//
// Run under: node .claude/skills/run-omega-client/driver.mjs
// (no xvfb needed - Chromium runs headless)
import { chromium } from 'playwright';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const APP_DIR = path.resolve(import.meta.dirname, '../../..');
const RENDERER_DIR = path.join(APP_DIR, 'dist-renderer');
const PORT = 4173;
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

let server = null;
let browser = null;
let page = null;

// A single instance, present from the moment the mock is installed - App.tsx
// calls instances.list() on mount and expects at least this shape.
const MOCK_INSTANCE = {
  id: 'inst-1', name: 'Demo Instance', gameDir: '/home/user/.minecraft-demo',
  versionId: '1.20.1', loader: 'fabric', modsDir: '/home/user/.minecraft-demo/mods',
  offlineUsername: 'Steve', accountId: 'acc-1',
  jvm: { javaPath: '', minRamMb: 2048, maxRamMb: 4096, extraArgs: '', useSmoothPvpFlags: true },
  window: { width: 854, height: 480, fullscreen: false },
  createdAt: Date.now(), lastPlayedAt: null, iconColor: '#48484f',
};

// A single already-linked account, present by default so the driver lands straight past
// App.tsx's mandatory sign-in gate (SignInRequired) into the normal app - the realistic steady
// state for testing every other screen. Set MOCK_SIGNED_OUT=1 before `launch` to start with zero
// accounts instead, to specifically test the gate itself (its "Sign in with Microsoft" button
// still works in that mode - the mock's addMicrosoft() always succeeds, unlike a real MSA login).
const MOCK_ACCOUNT = { id: 'acc-1', type: 'microsoft', username: 'Steve', uuid: 'demo-uuid-0000', addedAt: Date.now() };

// Every method preload.ts exposes on window.api. Return shapes here MUST
// match the real main-process handlers in src/main/*.ts exactly - a wrong
// shape (e.g. an object where the real handler returns a bare string[])
// produces a false-positive React crash. Grep src/main/main.ts's
// ipcMain.handle(...) calls before changing any shape here.
function installMockApi() {
  window.__calls = { launch: [], update: [], write: [] };
  window.api = {
    instances: {
      // Stateful: window.__mockInstances is seeded by an addInitScript in `launch` below, and
      // create/update/delete mutate it - so the New Instance flow, sidebar switching, and delete
      // actually round-trip like the real store-backed handlers do.
      list: async () => [...window.__mockInstances],
      create: async (input) => {
        const instance = { ...window.__mockInstance, ...input, id: 'inst-' + Date.now(), name: input.name };
        window.__mockInstances.push(instance);
        return instance;
      },
      update: async (instance) => {
        window.__calls.update.push(instance);
        window.__mockInstances = window.__mockInstances.map((i) => (i.id === instance.id ? instance : i));
        return instance;
      },
      delete: async (id) => { window.__mockInstances = window.__mockInstances.filter((i) => i.id !== id); },
      // detectInstalledVersions() in src/main/instances.ts returns DetectedVersion[] (shared/types.ts)
      // - {versionId, loader, jsonPath}, NOT the installer's {id, type} release shape.
      detectVersions: async (gameDir) => ([
        { versionId: '1.20.1', loader: 'fabric', jsonPath: gameDir + '/versions/1.20.1/1.20.1.json' },
      ]),
    },
    dialog: {
      pickDirectory: async () => '/home/user/.minecraft-demo',
      pickJarFiles: async () => [],
      pickShaderFiles: async () => [],
    },
    external: { open: async () => true },
    mods: {
      // listMods() in src/main/mods.ts returns full ModInfo objects (shared/types.ts) - the
      // Discover view matches its modId/fileName fields against Modrinth slugs, so a partial
      // shape here crashes DiscoverPanel. "sodium" doubles as the Discover view's installed-state
      // demo (it matches the mocked discover() hit below).
      list: async () => ([
        { id: 'omega-client-1.0.0.jar', fileName: 'omega-client-1.0.0.jar', modId: 'omega-client', name: 'Omega Client', version: '1.0.0', description: '', loader: 'fabric', enabled: true, tags: ['cpvp'], sizeBytes: 1024, importedAt: Date.now() },
        { id: 'sodium-fabric-0.5.jar', fileName: 'sodium-fabric-0.5.jar', modId: 'sodium', name: 'Sodium', version: '0.5', description: '', loader: 'fabric', enabled: true, tags: ['performance'], sizeBytes: 2048, importedAt: Date.now() },
      ]),
      import: async () => [],
      setEnabled: async () => {},
      remove: async () => {},
      applyPreset: async () => {},
      setEnabledBulk: async () => {},
      // searchDiscoveryMods() in src/main/modDiscovery.ts returns a DiscoveredModPage
      // ({hits, totalHits, offset}) - an empty query is the default "most downloaded compatible
      // mods" feed the Discover view opens with, and it pages 30 at a time as the user scrolls.
      // 75 canned mods = three pages, enough to exercise the infinite scroll for real.
      discover: async (_instance, query, offset = 0) => {
        const all = [
          { projectId: 'P-sodium', slug: 'sodium', title: 'Sodium', description: 'A modern rendering engine for Minecraft which greatly improves performance', author: 'jellysquid3', downloads: 5_300_000, iconUrl: null, categories: ['optimization'] },
          { projectId: 'P-lithium', slug: 'lithium', title: 'Lithium', description: 'No-compromises game logic optimization mod', author: 'jellysquid3', downloads: 3_200_000, iconUrl: null, categories: ['optimization'] },
          { projectId: 'P-modmenu', slug: 'modmenu', title: 'Mod Menu', description: 'Adds a mod menu to view the list of mods you have installed', author: 'Prospector', downloads: 2_900_000, iconUrl: null, categories: ['utility'] },
          ...[...Array(72)].map((_, i) => ({
            projectId: 'P-filler-' + i, slug: 'filler-mod-' + i, title: 'Filler Mod ' + i,
            description: 'Canned discovery result #' + i, author: 'author' + (i % 7),
            downloads: 900_000 - i * 1_000, iconUrl: null, categories: ['utility'],
          })),
        ];
        const q = (query ?? '').trim().toLowerCase();
        const filtered = q ? all.filter((m) => m.title.toLowerCase().includes(q) || m.slug.includes(q)) : all;
        return { hits: filtered.slice(offset, offset + 30), totalHits: filtered.length, offset };
      },
      // installDiscoveredMod() returns the instance's full refreshed ModInfo[] list.
      installDiscovered: async (_instance, projectId) => {
        window.__calls.write.push({ installDiscovered: projectId });
        const installed = await window.api.mods.list();
        return [
          ...installed,
          { id: 'lithium-fabric-0.11.jar', fileName: 'lithium-fabric-0.11.jar', modId: 'lithium', name: 'Lithium', version: '0.11', description: '', loader: 'fabric', enabled: true, tags: ['performance'], sizeBytes: 512, importedAt: Date.now() },
        ];
      },
    },
    shaders: { list: async () => [], import: async () => [], remove: async () => [] },
    modConfig: {
      find: async (_dir, modId) => (modId === 'omega-client' ? '/x/config/omega-client.json' : null),
      read: async () => ({ format: 'json', data: { fullbrightEnabled: false, hudEnabled: true } }),
      write: async (_path, _format, data) => { window.__calls.write.push(data); },
    },
    // detectJavaCandidates() in src/main/java.ts returns plain string[] - NOT
    // objects. This is the one shape that bit us the first time (React
    // error #31, "objects are not valid as a React child").
    java: {
      detect: async () => (['/usr/bin/java']),
      verify: async () => ({ ok: true, version: '17.0.9' }),
    },
    licensing: {
      redeem: async (key) => { window.__calls.write.push({ licensingRedeem: key }); return { ok: false, message: "That license key isn't valid." }; },
      listOwned: async () => ([]),
    },
    install: {
      listVersions: async () => ([{ id: '1.20.1', type: 'release', url: '' }]),
      start: async () => 'job-1',
      onProgress: () => () => {},
    },
    updates: {
      install: async () => true,
      checkNow: async () => 'checked',
      onReady: () => () => {},
    },
    settings: {
      get: async () => ({
        defaultJvm: { javaPath: '', minRamMb: 2048, maxRamMb: 4096, extraArgs: '', useSmoothPvpFlags: true },
        defaultOfflineUsername: 'Player',
        msaClientId: '',
        autoUpdateEnabled: true,
      }),
      set: async () => {},
    },
    accounts: {
      // window.__mockAccounts is seeded by a separate addInitScript in the `launch` command below
      // (MOCK_ACCOUNT by default, empty if MOCK_SIGNED_OUT=1) - real MSA login can't happen in
      // this environment, so addMicrosoft() always "succeeds" with a fake account instead of
      // throwing, so the sign-in gate's happy path is actually testable here.
      list: async () => ([...window.__mockAccounts]),
      addMicrosoft: async () => {
        const account = { id: 'acc-' + Date.now(), type: 'microsoft', username: 'MockUser', uuid: 'mock-uuid-' + Date.now(), addedAt: Date.now() };
        window.__mockAccounts.push(account);
        return account;
      },
      remove: async (id) => { window.__mockAccounts = window.__mockAccounts.filter((a) => a.id !== id); },
    },
    launch: {
      start: async (instance) => { window.__calls.launch.push(instance); },
      stop: async () => {},
      isRunning: async () => false,
      // The callback is exposed as window.__emitLog so a test can stream fake game output into the
      // app (e.g. `eval (() => { for (let i = 0; i < 50; i++) window.__emitLog({instanceId: 'inst-1',
      // stream: 'stdout', data: 'line ' + i}); })()`) and observe Console-tab behavior.
      onLog: (cb) => { window.__emitLog = cb; return () => {}; },
      onSwitchAccountRequested: () => () => {},
    },
  };
}

function serveRenderer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let p = path.join(RENDERER_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    }).listen(PORT, () => resolve());
  });
}

const COMMANDS = {
  async launch() {
    if (page) return console.log('already launched');
    if (!fs.existsSync(RENDERER_DIR)) {
      console.log(`ERROR: ${RENDERER_DIR} missing - run "npm run build:renderer" first`);
      return;
    }
    await serveRenderer();
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    page = await browser.newPage();
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
    await page.addInitScript(installMockApi);
    await page.addInitScript((inst) => { window.__mockInstance = inst; window.__mockInstances = [inst]; }, MOCK_INSTANCE);
    await page.addInitScript((acc) => { window.__mockAccounts = acc ? [acc] : []; }, process.env.MOCK_SIGNED_OUT ? null : MOCK_ACCOUNT);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    console.log('launched. title:', await page.title());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f, fullPage: true });
    console.log('screenshot:', f);
  },

  // DOM click, not locator.click() coordinates - simpler and always correct
  // for a plain single-window web page (no BrowserView layering concern
  // here since this isn't real Electron).
  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '->', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')];
      const el = els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '->', r);
  },

  // Toggles a checkbox found inside a <label> containing the given text
  // (matches this app's `<label className="field-checkbox"><input
  // type=checkbox/><span>Label text</span></label>` pattern throughout).
  async 'toggle-checkbox'(labelText) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate((t) => {
      const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.includes(t));
      if (!label) return 'LABEL_NOT_FOUND';
      const cb = label.querySelector('input[type=checkbox]');
      if (!cb) return 'CHECKBOX_NOT_FOUND';
      const before = cb.checked;
      cb.click();
      return `${before} -> ${cb.checked}`;
    }, labelText);
    console.log('toggle-checkbox', JSON.stringify(labelText), '->', r);
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 30 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate((s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)', sel || null));
  },

  // Introspect calls the app made into the mocked IPC (launch.start,
  // instances.update, modConfig.write) - use this to confirm a click
  // actually invoked the right IPC method with the right payload.
  async calls() {
    if (!page) return console.log('ERROR: launch first');
    console.log(JSON.stringify(await page.evaluate(() => window.__calls), null, 2));
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();
    browser = null; page = null; server = null;
  },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '- try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('omega-client driver - "help" for commands, "launch" to start');
rl.prompt();
