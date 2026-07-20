// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
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
 * `autoCheckEnabled` mirrors AppSettings.autoUpdateEnabled, read once at startup - it gates the
 * automatic startup check below. There's no user-facing toggle or manual "check now" action
 * anymore (removed from Settings/About); this just runs silently in the background.
 */
export function setupAutoUpdater(sendToRenderer: (channel: string, payload: unknown) => void, autoCheckEnabled: boolean): void {
  // Must exist even when the updater itself is inert (dev run / portable exe), or clicking the
  // renderer's restart-to-install banner button would throw "no handler registered".
  let updateReady = false;
  ipcMain.handle("updates:install", () => {
    if (updateReady) autoUpdater.quitAndInstall();
    return updateReady;
  });

  // Dev runs have no packaged metadata to compare against, and the portable .exe can't replace
  // itself in place (electron-builder sets PORTABLE_EXECUTABLE_DIR only in portable builds) -
  // portable users update by re-downloading, same as before.
  const updatable = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;
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
