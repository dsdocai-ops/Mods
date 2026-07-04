// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

function javaBinaryName(): string {
  return process.platform === "win32" ? "javaw.exe" : "java";
}

/** Walks a directory a few levels deep looking for a java(w) executable, e.g. under Mojang's bundled per-version runtimes. */
function findJavaUnder(root: string, depth = 4): string | null {
  if (!fs.existsSync(root) || depth <= 0) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }

  const target = javaBinaryName();
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === target.toLowerCase()) {
      return path.join(root, entry.name);
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && (entry.name === "bin" || depth > 1)) {
      const found = findJavaUnder(path.join(root, entry.name), depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/** Best-effort discovery of local Java installs, preferring a game-bundled runtime (matches the Mojang launcher's game version) over a system-wide one. */
export function detectJavaCandidates(gameDir?: string): string[] {
  const candidates = new Set<string>();

  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, "bin", javaBinaryName());
    if (fs.existsSync(p)) candidates.add(p);
  }

  if (gameDir) {
    const bundled = findJavaUnder(path.join(gameDir, "runtime"));
    if (bundled) candidates.add(bundled);
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const mojangRuntime = findJavaUnder(
        path.join(localAppData, "Packages", "Microsoft.4297127D64EC6_8wekyb3d8bbwe", "LocalCache", "Local", "runtime")
      );
      if (mojangRuntime) candidates.add(mojangRuntime);
    }
    for (const base of ["C:\\Program Files\\Java", "C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files (x86)\\Java"]) {
      const found = findJavaUnder(base, 2);
      if (found) candidates.add(found);
    }
  } else {
    for (const base of ["/usr/lib/jvm", "/opt/java"]) {
      const found = findJavaUnder(base, 2);
      if (found) candidates.add(found);
    }
    if (fs.existsSync("/usr/bin/java")) candidates.add("/usr/bin/java");
  }

  return [...candidates];
}

export function verifyJava(javaPath: string): Promise<{ ok: boolean; version: string }> {
  return new Promise((resolve) => {
    execFile(javaPath, ["-version"], (error, _stdout, stderr) => {
      if (error) {
        resolve({ ok: false, version: "" });
        return;
      }
      const match = /version "([^"]+)"/.exec(stderr);
      resolve({ ok: true, version: match?.[1] ?? "unknown" });
    });
  });
}
