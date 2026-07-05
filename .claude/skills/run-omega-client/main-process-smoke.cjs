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

// ---- licensing.ts (real licenses.json + real mod-config write + real local HMAC key check - no
// network call, no mocking of licensing.ts itself) ----
function runLicensingSection() {
  console.log("\n== licensing ==");
  const licensing = require(path.join(MAIN_DIR, "licensing.js"));

  check("getOwnedCosmetics() starts empty", licensing.getOwnedCosmetics().length === 0);

  // Same formula as licensing.ts's expectedSuffix() / scripts/generate-license-key.cjs - kept in
  // sync manually since the real secret is a private, per-deployment constant.
  const crypto = require("crypto");
  const LICENSE_SECRET = "REPLACE_ME_WITH_YOUR_OWN_SECRET";
  const validKey = "gold_badge-" + crypto.createHmac("sha256", LICENSE_SECRET).update("gold_badge").digest("hex").slice(0, 12);

  return licensing.redeemLicenseKey("not-a-real-key").then((malformedResult) => {
    check("redeemLicenseKey() reports ok:false for a malformed key", malformedResult.ok === false);
    check("redeemLicenseKey() gives a human-readable message", typeof malformedResult.message === "string" && malformedResult.message.length > 0);

    return licensing.redeemLicenseKey("unknown_cosmetic-abcdef123456").then((unknownResult) => {
      check("redeemLicenseKey() reports ok:false for an unknown cosmetic id", unknownResult.ok === false);

      return licensing.redeemLicenseKey("gold_badge-wrongsuffix1").then((wrongSuffixResult) => {
        check("redeemLicenseKey() reports ok:false for a wrong suffix", wrongSuffixResult.ok === false);
        check("redeemLicenseKey() hasn't unlocked anything yet", licensing.getOwnedCosmetics().length === 0);

        return licensing.redeemLicenseKey(validKey).then((validResult) => {
          check("redeemLicenseKey() reports ok:true for a real, correctly-formed key", validResult.ok === true);
          check("redeemLicenseKey() returns the matching cosmeticId", validResult.cosmeticId === "gold_badge");
          check("redeemLicenseKey() unlocked the cosmetic via the real HMAC-check+unlockCosmetic() path", licensing.getOwnedCosmetics().includes("gold_badge"));
          return runUnlockCosmeticSection(licensing);
        });
      });
    });
  }).catch((e) => {
    console.log("  FAIL licensing section threw:", e.message);
    failures++;
    finish();
  });
}

// unlockCosmetic() is the real, independently-callable function redeemLicenseKey() calls on a
// valid key - already exercised indirectly above, this confirms its on-disk side effects directly
// (licenses.json + every instance's config/omega-client.json) and its idempotency.
function runUnlockCosmeticSection(licensing) {
  return new Promise((resolve, reject) => {
    const instances = require(path.join(MAIN_DIR, "instances.js"));
    const licenseInstance = instances.createInstance({
      name: "License Smoke Instance",
      gameDir: path.join(SCRATCH, "minecraft-license"),
      versionId: "1.20.1",
      loader: "fabric",
    });

    licensing.unlockCosmetic("azure_badge");
    check("unlockCosmetic() adds the cosmetic to getOwnedCosmetics()", licensing.getOwnedCosmetics().includes("azure_badge"));

    const licensesFile = path.join(USER_DATA, "licenses.json");
    check("licenses.json actually exists on disk", fs.existsSync(licensesFile));
    const licensesOnDisk = JSON.parse(fs.readFileSync(licensesFile, "utf-8"));
    check("licenses.json on-disk content matches", Array.isArray(licensesOnDisk.ownedCosmetics) && licensesOnDisk.ownedCosmetics.includes("azure_badge"));

    const configPath = path.join(path.dirname(licenseInstance.modsDir), "config", "omega-client.json");
    check("unlockCosmetic() wrote a real config/omega-client.json for the instance", fs.existsSync(configPath));
    const configOnDisk = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    check("config/omega-client.json has ownedCosmeticId set", configOnDisk.ownedCosmeticId === "azure_badge");

    // Calling it again with the same id must not duplicate the entry.
    licensing.unlockCosmetic("azure_badge");
    const licensesAfterRepeat = JSON.parse(fs.readFileSync(licensesFile, "utf-8"));
    check("unlockCosmetic() is idempotent for an already-owned cosmetic", licensesAfterRepeat.ownedCosmetics.filter((id) => id === "azure_badge").length === 1);

    instances.removeInstance(licenseInstance.id);
    resolve();
  }).then(() => finish()).catch((e) => {
    console.log("  FAIL unlockCosmetic section threw:", e.message);
    failures++;
    finish();
  });
}


function finish() {
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}
