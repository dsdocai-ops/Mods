// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useState } from "react";
import { toast } from "../toast";

interface Props {
  /** Called after a Microsoft account is successfully linked - the caller re-checks accounts.list() and unlocks the app. */
  onSignedIn: () => void;
}

/**
 * Blocks the entire launcher (sidebar, instances, settings - everything) until at least one
 * Microsoft account is linked. Rendered instead of the normal app shell in App.tsx, not alongside
 * it - there is no "skip" or offline option here by design, matching how Lunar/Feather-style
 * launchers require sign-in before anything else is reachable. The Microsoft-account plumbing
 * itself (msAuth.ts, accountStore.ts) is unchanged; this only removes the ability to reach any
 * screen without using it first.
 */
export default function SignInRequired({ onSignedIn }: Props) {
  const [signingIn, setSigningIn] = useState(false);

  const signIn = async () => {
    setSigningIn(true);
    try {
      const account = await window.api.accounts.addMicrosoft();
      toast(`Signed in as ${account.username}`, "success");
      onSignedIn();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
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
      </div>
    </div>
  );
}
