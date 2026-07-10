// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useState } from "react";
import type { PublicAccount } from "@shared/types";
import { toast } from "../toast";

interface Props {
  /**
   * Called after a Microsoft account is linked. Returns the app's freshly-loaded account list so we
   * can confirm the sign-in actually unlocked the app (a linked-but-not-visible account is a distinct
   * failure worth naming, rather than silently bouncing back to this screen).
   */
  onSignedIn: () => Promise<PublicAccount[]>;
}

/**
 * Blocks the entire launcher until at least one Microsoft account is linked. Because everything -
 * including Settings, where you'd normally paste your own Microsoft client ID - lives behind this
 * gate, the client-ID override is offered right here too: if the shipped default ever fails to sign
 * in, there'd otherwise be no way to reach the field to fix it (chicken-and-egg). Errors are shown
 * inline (not just as an easily-missed toast) so a failed sign-in says exactly why.
 */
export default function SignInRequired({ onSignedIn }: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    window.api.settings.get().then((s) => setClientId(s.msaClientId));
  }, []);

  const signIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      // Persist a custom client ID (if the user entered one) before signing in, so addMicrosoft uses
      // it - the whole point of exposing it here is unblocking a broken shipped default.
      const settings = await window.api.settings.get();
      if (clientId.trim() !== settings.msaClientId) {
        await window.api.settings.set({ ...settings, msaClientId: clientId.trim() });
      }

      const account = await window.api.accounts.addMicrosoft();

      // Confirm the app actually sees the saved account. If sign-in "succeeded" but the app still has
      // no account, it would otherwise just bounce back here with no explanation - name that case.
      const list = await onSignedIn();
      if (!list.some((a) => a.id === account.id)) {
        setError(
          `Signed in as ${account.username}, but the launcher still can't see the saved account. The account file may have failed to write or read back - check the app's data-folder permissions, then try again.`
        );
        return;
      }
      toast(`Signed in as ${account.username}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setShowAdvanced(true); // a failure is exactly when the client-ID override becomes relevant
      toast(msg, "error");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="app-shell sign-in-required">
      <div className="welcome" style={{ margin: "auto" }}>
        <h1>Omega Client</h1>
        <p className="welcome-slogan">The last client you will ever need.</p>
        <p>Sign in with your Microsoft account to continue - Omega Client requires a real Minecraft account to play.</p>
        <button className="btn btn-primary" disabled={signingIn} onClick={signIn}>
          {signingIn ? "Signing in..." : "Sign in with Microsoft"}
        </button>

        {error && <p className="sign-in-error">{error}</p>}

        <button className="sign-in-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide advanced" : "Advanced: use your own Microsoft client ID"}
        </button>
        {showAdvanced && (
          <div className="sign-in-advanced">
            <p className="instance-subtitle">
              If sign-in fails with the shipped default, register your own Azure app (see the README&rsquo;s
              &ldquo;Microsoft sign-in&rdquo; section) and paste its Application (client) ID here.
            </p>
            <input
              className="input"
              placeholder="Azure Application (client) ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
