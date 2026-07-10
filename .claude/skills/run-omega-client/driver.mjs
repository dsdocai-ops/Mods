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
  offlineUsername: 'Steve', accountId: 'acc-1', autoUpdateMods: false,
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
  // Cosmetics demo state: owns a hat + a cape so the grouped grid shows owned/active/locked across
  // types; wings + the azure hat stay locked ("Buy") until "redeemed".
  window.__owned = ['gold_badge', 'crimson_cape'];
  window.__active = 'gold_badge';
  // Catalog ids the mock redeem will accept (mirrors shared/cosmetics.ts).
  window.__catalogIds = ['gold_badge', 'azure_badge', 'crimson_cape', 'emerald_cape', 'phantom_wings'];
  // A couple of extra instances so the Play screen's instance grid has something to show beyond
  // the single MOCK_INSTANCE (which the rest of the app keys off).
  const EXTRA_INSTANCES = [
    { ...window.__mockInstance, id: 'inst-2', name: 'CPvP Practice', versionId: '1.8.9', loader: 'forge' },
    { ...window.__mockInstance, id: 'inst-3', name: 'Bedwars', versionId: '1.20.4', loader: 'fabric' },
  ];
  window.api = {
    instances: {
      list: async () => [window.__mockInstance, ...EXTRA_INSTANCES],
      create: async (input) => ({ ...window.__mockInstance, ...input, id: 'inst-' + Date.now() }),
      update: async (instance) => { window.__calls.update.push(instance); return instance; },
      delete: async () => {},
      detectVersions: async () => ([{ id: '1.20.1', type: 'release' }]),
    },
    dialog: {
      pickDirectory: async () => '/home/user/.minecraft-demo',
      pickJarFiles: async () => [],
      pickShaderFiles: async () => [],
    },
    external: { open: async () => true },
    mods: {
      list: async () => ([
        { id: 'omega-client', fileName: 'omega-client-1.0.0.jar', enabled: true, name: 'Omega Client', tags: ['cpvp'] },
        { id: 'sodium', fileName: 'sodium-fabric-0.5.jar', enabled: true, name: 'Sodium', tags: ['performance'] },
      ]),
      import: async () => [],
      setEnabled: async () => {},
      remove: async () => {},
      applyPreset: async () => {},
      setEnabledBulk: async () => {},
    },
    // Modrinth mod browser. The real handlers live in src/main/modrinth.ts and hit
    // api.modrinth.com (blocked in this sandbox), so these stand in with a couple of fixed hits and
    // a fake progress stream so the Discover UI renders and its install flow is exercisable. icon_url
    // is left blank so no real network image is needed (the card's fallback swatch shows instead).
    modrinth: {
      search: async (query) => {
        const all = [
          { projectId: 'AANobbMI', slug: 'sodium', title: 'Sodium', description: 'A modern rendering engine that massively improves frame rates and reduces stuttering.', author: 'jellysquid3', downloads: 24000000, iconUrl: '', categories: ['performance', 'fabric'] },
          { projectId: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', description: 'No-compromises game logic/server optimization mod. Improves tick performance.', author: 'jellysquid3', downloads: 18000000, iconUrl: '', categories: ['performance', 'fabric'] },
          { projectId: 'P7dR8mSH', slug: 'fabric-api', title: 'Fabric API', description: 'Core library for the most common hooks and intercompatibility measures utilized by mods.', author: 'modmuss50', downloads: 42000000, iconUrl: '', categories: ['library', 'fabric'] },
          { projectId: 'YL57xq9U', slug: 'iris', title: 'Iris Shaders', description: 'A modern shaders mod compatible with Sodium and most OptiFine shaderpacks.', author: 'coderbot', downloads: 9000000, iconUrl: '', categories: ['visual', 'fabric'] },
        ];
        const q = (query || '').toLowerCase();
        return q ? all.filter((h) => h.title.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)) : all;
      },
      install: async (modsDir, projectId) => {
        // Emit a little fake progress stream like the real main process does, then resolve.
        const emit = window.__modrinthProgress;
        if (emit) {
          emit({ phase: 'resolving', name: projectId, done: 0, total: 0, detail: 'Resolving dependencies...' });
          emit({ phase: 'downloading', name: 'mod.jar', done: 0, total: 1, detail: 'Downloading (1/1)...' });
          emit({ phase: 'done', name: '', done: 1, total: 1, detail: 'Installed 1 file.' });
        }
        window.__calls.write.push({ modrinthInstall: projectId });
        return { installedFiles: ['mock-installed.jar'], skippedDependencies: [] };
      },
      // Reports one pretend update for the mocked Sodium jar (matches mods.list's fileName) so the
      // "N updates available" banner and per-row badge/button render. Clears once "updated" so the
      // demo flow (click Update all -> banner disappears) behaves.
      checkUpdates: async () => (window.__modrinthUpdated ? [] : [
        { fileName: 'sodium-fabric-0.5.jar', newVersion: '0.6.0', projectId: 'AANobbMI', url: '', newFileName: 'sodium-fabric-0.6.0.jar', sha1: 'deadbeef', enabled: true },
      ]),
      // Signature matches preload: (modsDir, updates, loader, versionId). Returns one extra file
      // beyond the updated jars to stand in for a newly-required dependency the updated build pulled
      // in, so the "+N new dependency" path is demoable offline.
      applyUpdates: async (modsDir, updates) => {
        const emit = window.__modrinthProgress;
        if (emit) emit({ phase: 'done', name: '', done: updates.length, total: updates.length, detail: `Updated ${updates.length} mod(s).` });
        window.__modrinthUpdated = true;
        window.__calls.write.push({ modrinthApplyUpdates: updates.map((u) => u.fileName) });
        return { installedFiles: [...updates.map((u) => u.newFileName), 'fabric-api-0.92.0.jar'], skippedDependencies: [] };
      },
      onProgress: (cb) => { window.__modrinthProgress = cb; return () => { window.__modrinthProgress = null; }; },
    },
    shaders: {
      list: async () => [],
      import: async () => [],
      remove: async () => [],
      // Report no loader by default so the opt-in "Install shader loader" card renders; install
      // "succeeds" and flips it present.
      hasLoader: async () => !!window.__shaderLoaderInstalled,
      installLoader: async () => {
        window.__shaderLoaderInstalled = true;
        window.__calls.write.push({ shaderInstallLoader: true });
        return { installed: ['iris-fabric-1.7.0.jar', 'sodium-fabric-0.5.8.jar'] };
      },
    },
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
      // Owns the gold badge by default (active), so the Cosmetics grid shows owned/active/locked
      // states and the picker is exercisable offline. azure stays locked ("Buy") until "redeemed".
      redeem: async (key) => {
        window.__calls.write.push({ licensingRedeem: key });
        // A key shaped "<catalogId>-<suffix>" unlocks that cosmetic (mirrors licensing.ts's format).
        const id = typeof key === 'string' ? window.__catalogIds.find((c) => key.startsWith(c + '-')) : null;
        if (id) {
          if (!window.__owned.includes(id)) window.__owned.push(id);
          window.__active = id;
          return { ok: true, cosmeticId: id, message: 'Unlocked: ' + id };
        }
        return { ok: false, message: "That license key isn't valid." };
      },
      listOwned: async () => ([...window.__owned]),
      getActive: async () => window.__active,
      setActive: async (id) => { window.__active = id; window.__calls.write.push({ setActiveCosmetic: id }); return id; },
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
        showModDownloadWarning: true,
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
      onLog: () => () => {},
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
    await page.addInitScript((inst) => { window.__mockInstance = inst; }, MOCK_INSTANCE);
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
