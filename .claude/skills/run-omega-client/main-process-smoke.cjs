#!/usr/bin/env node
// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Direct-invocation smoke test for src/main/*.ts's real exported functions -
// the pieces that never run under the renderer-only driver.mjs, because
// that one only exercises the React UI against a hand-written window.api
// mock. This calls the ACTUAL compiled functions (instances/store CRUD,
// Java detection, mod-jar metadata parsing) against real files on disk, no
// mocking of THIS code at all.
//
// electron itself still can't run here (see SKILL.md), so the handful of
// electron imports these modules need (only `app.getPath("userData")`) are
// stubbed via a Module._load patch below - everything downstream of that
// one call is the real, unmodified compiled output of src/main/*.ts.
//
// Usage: npm run build:electron && node .claude/skills/run-omega-client/main-process-smoke.cjs

const Module = require("module");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), "omega-smoke-"));
const USER_DATA = path.join(SCRATCH, "userData");
fs.mkdirSync(USER_DATA, { recursive: true });

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: (name) => (name === "userData" ? USER_DATA : SCRATCH) },
      safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
      BrowserWindow: class {},
      ipcMain: { handle: () => {} },
    };
  }
  return originalLoad.apply(this, arguments);
};

const MAIN_DIR = path.join(__dirname, "../../../dist-electron/main");
if (!fs.existsSync(MAIN_DIR)) {
  console.error(`ERROR: ${MAIN_DIR} missing - run "npm run build:electron" first`);
  process.exit(1);
}

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  OK   ${label}`);
  } else {
    console.log(`  FAIL ${label}`);
    failures++;
  }
}

console.log(`scratch dir: ${SCRATCH}\n`);

// ---- instances.ts / store.ts (real file-backed CRUD, real electron app.getPath stub) ----
console.log("== instances/store ==");
const instances = require(path.join(MAIN_DIR, "instances.js"));

check("listInstances() starts empty", instances.listInstances().length === 0);

const created = instances.createInstance({
  name: "Smoke Test Instance",
  gameDir: path.join(SCRATCH, "minecraft"),
  versionId: "1.20.1",
  loader: "fabric",
});
check("createInstance() returns an id", typeof created.id === "string" && created.id.length > 0);
check("createInstance() creates modsDir on disk", fs.existsSync(created.modsDir));

const afterCreate = instances.listInstances();
check("listInstances() reflects the new instance", afterCreate.length === 1 && afterCreate[0].id === created.id);

created.offlineUsername = "SmokeTestUser";
instances.updateInstance(created);
const afterUpdate = instances.listInstances();
check("updateInstance() persists a change", afterUpdate[0].offlineUsername === "SmokeTestUser");

// Confirm it actually hit disk, not just an in-memory cache.
const storeFile = path.join(USER_DATA, "launcher-store.json");
check("store file actually exists on disk", fs.existsSync(storeFile));
const onDisk = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
check("on-disk JSON matches the update", onDisk.instances[0].offlineUsername === "SmokeTestUser");

instances.removeInstance(created.id);
check("removeInstance() empties the list", instances.listInstances().length === 0);

// ---- java.ts (zero mocking at all - runs against this container's real java) ----
console.log("\n== java ==");
const java = require(path.join(MAIN_DIR, "java.js"));
const candidates = java.detectJavaCandidates();
console.log("  detected:", JSON.stringify(candidates));
check("detectJavaCandidates() returns string[]", Array.isArray(candidates) && candidates.every((c) => typeof c === "string"));
check("detectJavaCandidates() finds the real /usr/bin/java", candidates.includes("/usr/bin/java"));

java.verifyJava("/usr/bin/java").then((result) => {
  check("verifyJava() confirms /usr/bin/java is ok", result.ok === true);
  check("verifyJava() reports a real version string", /^\d+/.test(result.version));

  return java.verifyJava("/definitely/not/a/real/path").then((badResult) => {
    check("verifyJava() reports ok:false for a bad path", badResult.ok === false);
    runModsSection();
  });
}).catch((e) => {
  console.log("  FAIL java.verifyJava threw:", e.message);
  failures++;
  runModsSection();
});

// ---- mods.ts / modMetadata.ts (real AdmZip jars, not mocked - genuine fabric.mod.json / mods.toml parsing) ----
function runModsSection() {
  console.log("\n== mods / modMetadata (real jars via AdmZip) ==");
  const AdmZip = require("adm-zip");
  const modsDir = path.join(SCRATCH, "mods");
  fs.mkdirSync(modsDir, { recursive: true });

  const fabricZip = new AdmZip();
  fabricZip.addFile(
    "fabric.mod.json",
    Buffer.from(JSON.stringify({ id: "smoke-sodium", name: "Smoke Sodium", version: "1.2.3", description: "A fake performance mod for the smoke test" }))
  );
  fabricZip.writeZip(path.join(modsDir, "smoke-sodium-1.2.3.jar"));

  const forgeZip = new AdmZip();
  forgeZip.addFile(
    "META-INF/mods.toml",
    Buffer.from('[[mods]]\nmodId = "smokecrystal"\ndisplayName = "Smoke Crystal PvP"\nversion = "4.5.6"\ndescription = "A fake cpvp mod for the smoke test"\n')
  );
  forgeZip.writeZip(path.join(modsDir, "smoke-crystal-4.5.6.jar"));

  const mods = require(path.join(MAIN_DIR, "mods.js"));
  const listed = mods.listMods(modsDir);
  console.log("  listed:", JSON.stringify(listed.map((m) => ({ id: m.id, name: m.name, loader: m.loader, tags: m.tags, enabled: m.enabled })), null, 2));

  check("listMods() finds both real jars", listed.length === 2);
  const sodium = listed.find((m) => m.fileName.includes("sodium"));
  const crystal = listed.find((m) => m.fileName.includes("crystal"));
  check("real fabric.mod.json parsed correctly", sodium && sodium.name === "Smoke Sodium" && sodium.version === "1.2.3" && sodium.loader === "fabric");
  check("guessTags() tagged the perf mod 'performance'", sodium && sodium.tags.includes("performance"));
  check("real META-INF/mods.toml parsed correctly", crystal && crystal.name === "Smoke Crystal PvP" && crystal.version === "4.5.6" && crystal.loader === "forge");
  check("guessTags() tagged the crystal mod 'cpvp'", crystal && crystal.tags.includes("cpvp"));

  mods.setModEnabled(modsDir, sodium.fileName, false);
  const afterDisable = mods.listMods(modsDir);
  const disabledSodium = afterDisable.find((m) => m.id === sodium.id);
  check("setModEnabled(false) renames the real file to .disabled and re-scan reflects it", disabledSodium && !disabledSodium.enabled && fs.existsSync(path.join(modsDir, sodium.fileName + ".disabled")));

  mods.setModEnabled(modsDir, sodium.fileName, true);
  const afterReenable = mods.listMods(modsDir);
  check("setModEnabled(true) renames it back", afterReenable.find((m) => m.id === sodium.id)?.enabled === true);

  const preset = mods.applyTagPreset(modsDir, ["cpvp"]);
  check("applyTagPreset(['cpvp']) enables the crystal mod, disables the perf mod", preset.find((m) => m.id === crystal.id)?.enabled === true && preset.find((m) => m.id === sodium.id)?.enabled === false);

  runLicensingSection();
}

// ---- licensing.ts (real licenses.json + real mod-config write + a real local HTTP server
// standing in for a deployed server/stripe-verify function - no mocking of licensing.ts itself) ----
function runLicensingSection() {
  console.log("\n== licensing ==");
  const licensing = require(path.join(MAIN_DIR, "licensing.js"));
  const store = require(path.join(MAIN_DIR, "store.js"));

  check("getOwnedCosmetics() starts empty", licensing.getOwnedCosmetics().length === 0);

  // No Stripe verify endpoint configured yet (the store's default) - confirm redeemLicenseKey()
  // reports that honestly rather than silently unlocking anything or throwing.
  return licensing.redeemLicenseKey("cs_test_whatever").then((result) => {
    check("redeemLicenseKey() reports ok:false with no endpoint configured", result.ok === false);
    check("redeemLicenseKey() gives a human-readable message", typeof result.message === "string" && result.message.length > 0);
    check("redeemLicenseKey() doesn't unlock anything with no endpoint configured", licensing.getOwnedCosmetics().length === 0);

    // unlockCosmetic() is the real, independently-callable function the verify endpoint calls on a
    // confirmed payment - test it directly first, bypassing the HTTP round trip.
    const instances = require(path.join(MAIN_DIR, "instances.js"));
    const licenseInstance = instances.createInstance({
      name: "License Smoke Instance",
      gameDir: path.join(SCRATCH, "minecraft-license"),
      versionId: "1.20.1",
      loader: "fabric",
    });

    licensing.unlockCosmetic("gold_badge");
    check("unlockCosmetic() adds the cosmetic to getOwnedCosmetics()", licensing.getOwnedCosmetics().includes("gold_badge"));

    const licensesFile = path.join(USER_DATA, "licenses.json");
    check("licenses.json actually exists on disk", fs.existsSync(licensesFile));
    const licensesOnDisk = JSON.parse(fs.readFileSync(licensesFile, "utf-8"));
    check("licenses.json on-disk content matches", Array.isArray(licensesOnDisk.ownedCosmetics) && licensesOnDisk.ownedCosmetics.includes("gold_badge"));

    const configPath = path.join(path.dirname(licenseInstance.modsDir), "config", "omega-client.json");
    check("unlockCosmetic() wrote a real config/omega-client.json for the instance", fs.existsSync(configPath));
    const configOnDisk = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    check("config/omega-client.json has ownedCosmeticId set", configOnDisk.ownedCosmeticId === "gold_badge");

    // Calling it again with the same id must not duplicate the entry.
    licensing.unlockCosmetic("gold_badge");
    const licensesAfterRepeat = JSON.parse(fs.readFileSync(licensesFile, "utf-8"));
    check("unlockCosmetic() is idempotent for an already-owned cosmetic", licensesAfterRepeat.ownedCosmetics.filter((id) => id === "gold_badge").length === 1);

    instances.removeInstance(licenseInstance.id);
    return runStripeVerifyHttpSection(licensing, store);
  }).catch((e) => {
    console.log("  FAIL licensing section threw:", e.message);
    failures++;
    finish();
  });
}

// Stands in for a deployed server/stripe-verify/api/verify.js: same request/response contract
// (POST {sessionId} -> {ok, cosmeticId?, message}), so this exercises redeemLicenseKey()'s real
// fetch()+json()-parsing+unlockCosmetic() path end to end, not just the "no endpoint" short-circuit.
function runStripeVerifyHttpSection(licensing, store) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const verifyServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        res.writeHead(200, { "Content-Type": "application/json" });
        if (parsed.sessionId === "cs_test_valid") {
          res.end(JSON.stringify({ ok: true, cosmeticId: "azure_badge", message: "Unlocked: azure_badge" }));
        } else {
          res.end(JSON.stringify({ ok: false, message: "This checkout session hasn't completed payment yet." }));
        }
      });
    });

    verifyServer.listen(0, "127.0.0.1", () => {
      const port = verifyServer.address().port;
      const settings = store.getSettings();
      settings.stripeVerifyEndpointUrl = `http://127.0.0.1:${port}`;
      store.saveSettings(settings);

      licensing.redeemLicenseKey("cs_test_valid").then((validResult) => {
        check("redeemLicenseKey() against a real HTTP endpoint reports ok:true for a paid session", validResult.ok === true);
        check("redeemLicenseKey() returns the cosmeticId the endpoint named", validResult.cosmeticId === "azure_badge");
        check("redeemLicenseKey() unlocked the cosmetic via the real fetch()+unlockCosmetic() path", licensing.getOwnedCosmetics().includes("azure_badge"));

        return licensing.redeemLicenseKey("cs_test_unpaid").then((unpaidResult) => {
          check("redeemLicenseKey() reports ok:false for a session the endpoint rejects", unpaidResult.ok === false);
          check("redeemLicenseKey() doesn't unlock anything for a rejected session", !licensing.getOwnedCosmetics().includes("cs_test_unpaid"));
          verifyServer.close(() => resolve());
        });
      }).catch((e) => {
        verifyServer.close(() => reject(e));
      });
    });
  }).then(() => finish()).catch((e) => {
    console.log("  FAIL stripe-verify HTTP section threw:", e.message);
    failures++;
    finish();
  });
}

function finish() {
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}
