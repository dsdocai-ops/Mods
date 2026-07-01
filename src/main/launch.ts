import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import AdmZip from "adm-zip";
import type { Instance, LaunchLogEvent } from "../shared/types";
import { resolveVersion, findClientJar, resolveArgTokens, evaluateRules, mavenNameToPath, type LibraryEntry } from "./versionResolver";

/** Aikar's-flags-style G1GC tuning: trades a bit of memory for far fewer GC-pause frame hitches, which matters most in PvP. */
const SMOOTH_PVP_JVM_FLAGS = [
  "-XX:+UseG1GC",
  "-XX:+ParallelRefProcEnabled",
  "-XX:MaxGCPauseMillis=130",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+DisableExplicitGC",
  "-XX:+AlwaysPreTouch",
  "-XX:G1NewSizePercent=30",
  "-XX:G1MaxNewSizePercent=40",
  "-XX:G1HeapRegionSize=8M",
  "-XX:G1ReservePercent=20",
  "-XX:G1HeapWastePercent=5",
  "-XX:G1MixedGCCountTarget=4",
  "-XX:InitiatingHeapOccupancyPercent=15",
  "-XX:G1MixedGCLiveThresholdPercent=90",
  "-XX:SurvivorRatio=32",
  "-XX:+PerfDisableSharedMem",
  "-XX:MaxTenuringThreshold=1",
];

function offlineUuid(username: string): string {
  const digest = crypto.createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest();
  digest[6] = (digest[6] & 0x0f) | 0x30;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nativesClassifierForCurrentOs(lib: LibraryEntry): string | undefined {
  const key = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";
  const raw = lib.natives?.[key];
  if (!raw) return undefined;
  return raw.replace("${arch}", process.arch === "x64" ? "64" : "32");
}

function extractNatives(gameDir: string, libraries: LibraryEntry[], destDir: string, log: (line: string) => void): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const lib of libraries) {
    if (!evaluateRules(lib.rules, {})) continue;
    const classifier = nativesClassifierForCurrentOs(lib);
    if (!classifier) continue;
    const artifact = lib.downloads?.classifiers?.[classifier];
    const relPath = artifact?.path ?? mavenNameToPath(`${lib.name}:${classifier}`);
    const jarPath = path.join(gameDir, "libraries", relPath);
    if (!fs.existsSync(jarPath)) {
      log(`[launcher] warning: natives jar missing on disk: ${jarPath}`);
      continue;
    }
    try {
      const zip = new AdmZip(jarPath);
      const exclude = lib.extract?.exclude ?? ["META-INF/"];
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        if (exclude.some((ex) => entry.entryName.startsWith(ex))) continue;
        zip.extractEntryTo(entry, destDir, false, true);
      }
    } catch (err) {
      log(`[launcher] warning: failed to extract natives from ${jarPath}: ${String(err)}`);
    }
  }
}

function buildClasspath(gameDir: string, libraries: LibraryEntry[], clientJar: string | null, log: (line: string) => void): string[] {
  const entries: string[] = [];
  for (const lib of libraries) {
    if (!evaluateRules(lib.rules, {})) continue;
    // Natives-only libraries (no plain artifact) are extracted, not put on the classpath.
    if (lib.natives && !lib.downloads?.artifact) continue;

    const relPath = lib.downloads?.artifact?.path ?? mavenNameToPath(lib.name);
    const fullPath = path.join(gameDir, "libraries", relPath);
    if (!fs.existsSync(fullPath)) {
      log(`[launcher] warning: library missing on disk: ${fullPath}`);
      continue;
    }
    entries.push(fullPath);
  }
  if (clientJar) entries.push(clientJar);
  return entries;
}

export interface LaunchHandle {
  process: ChildProcess;
}

export function launchInstance(instance: Instance, onLog: (event: LaunchLogEvent) => void): LaunchHandle {
  const log = (line: string) => onLog({ instanceId: instance.id, stream: "status", data: line });

  const resolved = resolveVersion(instance.gameDir, instance.versionId);
  const clientJar = findClientJar(instance.gameDir, resolved.chainIds);
  if (!clientJar) {
    throw new Error(
      `Could not locate a client .jar for version "${instance.versionId}". Make sure the base vanilla version is fully installed in ${instance.gameDir}.`
    );
  }

  const runDir = path.dirname(instance.modsDir);
  fs.mkdirSync(instance.modsDir, { recursive: true });

  const nativesDir = path.join(os.tmpdir(), "omega-client", `natives-${instance.id}-${Date.now()}`);
  log(`Extracting natives to ${nativesDir}`);
  extractNatives(instance.gameDir, resolved.libraries, nativesDir, log);

  const classpath = buildClasspath(instance.gameDir, resolved.libraries, clientJar, log);
  const classpathString = classpath.join(path.delimiter);

  const uuid = offlineUuid(instance.offlineUsername);
  const assetsDir = path.join(instance.gameDir, "assets");

  const placeholderValues: Record<string, string> = {
    auth_player_name: instance.offlineUsername,
    version_name: resolved.id,
    game_directory: runDir,
    assets_root: assetsDir,
    game_assets: assetsDir,
    assets_index_name: resolved.assetIndexId,
    auth_uuid: uuid,
    auth_access_token: "0",
    auth_xuid: "0",
    clientid: "0",
    user_type: "legacy",
    version_type: resolved.type,
    natives_directory: nativesDir,
    launcher_name: "OmegaClient",
    launcher_version: "0.1.0",
    classpath: classpathString,
    classpath_separator: path.delimiter,
    library_directory: path.join(instance.gameDir, "libraries"),
    resolution_width: String(instance.window.width),
    resolution_height: String(instance.window.height),
  };

  const features = {
    has_custom_resolution: !instance.window.fullscreen,
    has_quick_plays_support: false,
    is_demo_user: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false,
  };

  const templatedJvmArgs = resolveArgTokens(resolved.jvmArgTokens, features, placeholderValues);
  const gameArgs = resolveArgTokens(resolved.gameArgTokens, features, placeholderValues);

  const userExtraArgs = instance.jvm.extraArgs.trim().length > 0 ? instance.jvm.extraArgs.trim().split(/\s+/) : [];

  const jvmArgs = [
    `-Xms${instance.jvm.minRamMb}M`,
    `-Xmx${instance.jvm.maxRamMb}M`,
    ...(instance.jvm.useSmoothPvpFlags ? SMOOTH_PVP_JVM_FLAGS : []),
    ...userExtraArgs,
    ...templatedJvmArgs,
  ];

  if (!instance.window.fullscreen && !gameArgs.includes("--width")) {
    gameArgs.push("--width", String(instance.window.width), "--height", String(instance.window.height));
  }
  if (instance.window.fullscreen && !gameArgs.includes("--fullscreen")) {
    gameArgs.push("--fullscreen");
  }

  const fullArgs = [...jvmArgs, resolved.mainClass, ...gameArgs];

  const javaPath = instance.jvm.javaPath || "java";
  log(`Launching: ${javaPath} (${resolved.id} / ${instance.loader})`);
  log(`Classpath entries: ${classpath.length}`);

  const child = spawn(javaPath, fullArgs, {
    cwd: runDir,
    env: process.env,
  });

  child.stdout?.on("data", (chunk: Buffer) => onLog({ instanceId: instance.id, stream: "stdout", data: chunk.toString() }));
  child.stderr?.on("data", (chunk: Buffer) => onLog({ instanceId: instance.id, stream: "stderr", data: chunk.toString() }));
  child.on("exit", (code) => {
    onLog({ instanceId: instance.id, stream: "exit", data: String(code ?? "unknown") });
    fs.rm(nativesDir, { recursive: true, force: true }, () => undefined);
  });
  child.on("error", (err) => {
    onLog({ instanceId: instance.id, stream: "stderr", data: `Failed to start Java process: ${err.message}` });
  });

  return { process: child };
}
