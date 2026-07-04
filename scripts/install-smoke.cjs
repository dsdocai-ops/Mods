// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Runtime smoke test for the Minecraft install engine, run by CI (the dev sandbox that writes
// this code can't reach Mojang's CDNs, so this is the only place the download path actually
// executes). Installs vanilla 1.20.1 into a temp dir - skipping the ~350MB of individual asset
// objects, everything else for real - then asserts the result is launch-shaped: the version
// resolver can resolve it, the client jar exists, and the libraries it lists are on disk.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { installVanilla, listInstallableVersions } = require("../dist-electron/main/installer.js");
const { resolveVersion, findClientJar, evaluateRules, mavenNameToPath } = require("../dist-electron/main/versionResolver.js");

const TARGET = "1.20.1";

(async () => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), "omega-install-smoke-"));
  console.log(`Installing ${TARGET} (assets index only) into ${gameDir}`);

  const versions = await listInstallableVersions();
  if (!versions.some((v) => v.id === TARGET)) {
    throw new Error(`Manifest is missing ${TARGET} - got ${versions.length} releases`);
  }

  await installVanilla(
    gameDir,
    TARGET,
    (p) => {
      if (p.done === 0 || p.done === p.total) console.log(`  [${p.phase}] ${p.detail}`);
    },
    { skipAssetObjects: true }
  );

  const resolved = resolveVersion(gameDir, TARGET);
  if (!resolved.mainClass) throw new Error("Resolved version has no mainClass");

  const clientJar = findClientJar(gameDir, resolved.chainIds);
  if (!clientJar) throw new Error("Client jar not found after install");

  let missing = 0;
  for (const lib of resolved.libraries) {
    if (!evaluateRules(lib.rules, {})) continue;
    if (lib.natives && !lib.downloads?.artifact) continue;
    const relPath = lib.downloads?.artifact?.path ?? mavenNameToPath(lib.name);
    if (!fs.existsSync(path.join(gameDir, "libraries", relPath))) {
      console.error(`  MISSING library: ${relPath}`);
      missing++;
    }
  }
  if (missing > 0) throw new Error(`${missing} resolved libraries missing on disk`);

  console.log(`SMOKE OK: ${resolved.id}, mainClass=${resolved.mainClass}, ${resolved.libraries.length} libraries, jar=${path.basename(clientJar)}`);
  fs.rmSync(gameDir, { recursive: true, force: true });
})().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
