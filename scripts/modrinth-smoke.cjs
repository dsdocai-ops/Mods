// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Runtime smoke test for the Modrinth mod browser, run by CI (the dev sandbox that writes this code
// can't reach api.modrinth.com / cdn.modrinth.com, so this is the only place the real API path
// executes). Validates the assumptions src/main/modrinth.ts makes about Modrinth's v2 response
// shapes by actually hitting the live API: searches for a well-known mod, then installs it (and any
// required dependencies) into a temp dir and asserts the jar landed on disk.
//
// Uses only the public, unauthenticated endpoints - no API key or account. If Modrinth changes a
// field name or a facet's meaning, this fails here in CI instead of silently returning empty
// results (or crashing) in a shipped build.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { searchModrinth, installFromModrinth, minecraftVersionOf } = require("../dist-electron/main/modrinth.js");

// Sodium: one of the most-downloaded Fabric mods, stable slug/id, exists for 1.20.1 - a safe fixture.
const PROJECT_ID = "AANobbMI"; // sodium
const LOADER = "fabric";
const VERSION_ID = "1.20.1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  // Pure helper first - no network, but catches a regression in the loader-profile -> MC-version
  // extraction the whole search/install path depends on.
  assert(minecraftVersionOf("fabric-loader-0.15.11-1.20.1") === "1.20.1", "minecraftVersionOf failed on a Fabric profile id");
  assert(minecraftVersionOf("1.20.1-forge-47.2.0") === "1.20.1", "minecraftVersionOf failed on a Forge id");

  console.log(`Searching Modrinth for "sodium" (${LOADER}, ${VERSION_ID})...`);
  const hits = await searchModrinth("sodium", LOADER, VERSION_ID);
  assert(Array.isArray(hits) && hits.length > 0, "search returned no hits");
  const first = hits[0];
  for (const field of ["projectId", "slug", "title"]) {
    assert(typeof first[field] === "string" && first[field].length > 0, `search hit missing ${field}`);
  }
  assert(typeof first.downloads === "number", "search hit downloads is not a number");
  console.log(`  ${hits.length} hits; top result: ${first.title} by ${first.author} (${first.downloads} downloads)`);

  const modsDir = fs.mkdtempSync(path.join(os.tmpdir(), "omega-modrinth-smoke-"));
  try {
    console.log(`Installing project ${PROJECT_ID} into ${modsDir}...`);
    const result = await installFromModrinth(modsDir, PROJECT_ID, LOADER, VERSION_ID, (p) => {
      if (p.phase === "downloading" && (p.done === 0 || p.done === p.total - 1)) console.log(`  [${p.phase}] ${p.detail}`);
    });

    assert(result.installedFiles.length >= 1, "install reported no installed files");
    for (const file of result.installedFiles) {
      const full = path.join(modsDir, file);
      assert(fs.existsSync(full), `installed file missing on disk: ${file}`);
      assert(fs.statSync(full).size > 0, `installed file is empty: ${file}`);
      assert(file.toLowerCase().endsWith(".jar"), `installed file is not a jar: ${file}`);
    }

    console.log(
      `SMOKE OK: installed ${result.installedFiles.length} jar(s) [${result.installedFiles.join(", ")}]` +
        (result.skippedDependencies.length ? `, skipped deps: ${result.skippedDependencies.join(", ")}` : "")
    );
  } finally {
    fs.rmSync(modsDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
