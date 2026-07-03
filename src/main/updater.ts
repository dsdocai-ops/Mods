import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Auto-update against the rolling `latest-build` GitHub Release, via electron-updater's *generic*
 * provider rather than its GitHub provider - the GitHub provider insists on semver release tags to
 * find "the latest release", and our rolling tag is the deliberately un-semver `latest-build`. The
 * generic provider just fetches `<url>/latest.yml` (which CI regenerates with a version of
 * 0.1.<run number>, so it always compares newer than any installed build) and downloads the
 * installer named inside it from the same URL.
 *
 * Downloads happen silently in the background; the renderer shows a "restart to update" banner
 * once the update is ready, and even if the user ignores it, electron-updater installs on the
 * next normal quit (autoInstallOnAppQuit). Errors are logged and swallowed - an offline launcher
 * must behave exactly like an up-to-date one.
 *
 * `autoCheckEnabled` mirrors AppSettings.autoUpdateEnabled, read once at startup (Settings ->
 * Launcher Updates) - it only gates the automatic startup check below. The Settings page's
 * "Check for updates" button always calls `updates:checkNow` regardless of the toggle, since a
 * manual click is unambiguous intent either way; toggling the setting itself just changes what
 * happens on the *next* app start (there's no in-flight check to cancel once one has started).
 */
export function setupAutoUpdater(sendToRenderer: (channel: string, payload: unknown) => void, autoCheckEnabled: boolean): void {
  // Every IPC handler below must exist even when the updater itself is inert (dev run / portable
  // exe), or clicking the renderer's install/check-now buttons would throw "no handler registered".
  let updateReady = false;
  ipcMain.handle("updates:install", () => {
    if (updateReady) autoUpdater.quitAndInstall();
    return updateReady;
  });

  // Dev runs have no packaged metadata to compare against, and the portable .exe can't replace
  // itself in place (electron-builder sets PORTABLE_EXECUTABLE_DIR only in portable builds) -
  // portable users update by re-downloading, same as before.
  const updatable = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;

  ipcMain.handle("updates:checkNow", async (): Promise<"unsupported" | "ready" | "downloading" | "checked" | "error"> => {
    if (!updatable) return "unsupported";
    try {
      const result = await autoUpdater.checkForUpdates();
      if (updateReady) return "ready";
      // checkForUpdates() resolves once the version-check step finishes, not once the (autoDownload)
      // download completes - that only happens later, via the update-downloaded listener below. A
      // truthy downloadPromise means a newer version was found and a download just started in the
      // background; without this check a found-but-still-downloading update was reported as
      // "checked" (i.e. "you're up to date"), which is simply wrong.
      return result?.downloadPromise ? "downloading" : "checked";
    } catch (err) {
      console.warn("[updater] manual check failed: " + (err instanceof Error ? err.message : String(err)));
      return "error";
    }
  });

  if (!updatable) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (info) => {
    updateReady = true;
    sendToRenderer("updates:ready", info.version);
  });
  autoUpdater.on("error", (err) => {
    console.warn("[updater] " + (err instanceof Error ? err.message : String(err)));
  });

  if (autoCheckEnabled) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn("[updater] check failed: " + (err instanceof Error ? err.message : String(err)));
    });
  }
}
