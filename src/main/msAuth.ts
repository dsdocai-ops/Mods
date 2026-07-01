import crypto from "node:crypto";
import { BrowserWindow } from "electron";

/**
 * Microsoft OAuth -> Xbox Live -> XSTS -> Minecraft token chain. This is the same public,
 * documented flow every third-party launcher (MultiMC, Prism, etc.) uses - unlike most of the
 * mod work in this project, these are stable REST APIs with a well-known shape, not obfuscated
 * internal game classes, so confidence here is high even though none of it has been exercised
 * against a real Microsoft account (that needs your own Azure app registration - see README).
 */

const AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
// Microsoft's documented "no local server needed" redirect for public desktop/native apps.
const REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const SCOPE = "XboxLive.signin offline_access";

export interface MicrosoftAccountResult {
  msRefreshToken: string;
  mcAccessToken: string;
  mcAccessTokenExpiresAt: number;
  username: string;
  uuid: string;
}

class HttpJsonError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: any
  ) {
    super(message);
  }
}

const XSTS_ERROR_MESSAGES: Record<string, string> = {
  "2148916233": "This Microsoft account doesn't have an Xbox profile yet. Create one at xbox.com, then try again.",
  "2148916235": "Xbox Live isn't available for this account's region.",
  "2148916236": "This account needs adult verification.",
  "2148916237": "This account needs adult verification.",
  "2148916238": "This is a child account - an adult needs to add it to a Microsoft Family group first.",
};

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(64));
}

function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
}

/** Minecraft's profile API returns the UUID without dashes; launch args expect the dashed form. */
function formatUuid(raw: string): string {
  if (raw.includes("-")) return raw;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Microsoft token request failed: ${json.error_description ?? json.error ?? response.statusText}`);
  }
  return json;
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpJsonError(`Request to ${url} failed (${response.status})`, response.status, json);
  }
  return json;
}

/** Opens a modal sign-in window and resolves with the OAuth authorization code once Microsoft redirects back. */
function captureAuthorizationCode(authUrl: string, expectedState: string, parentWindow: BrowserWindow): Promise<string> {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 650,
      parent: parentWindow,
      modal: true,
      autoHideMenuBar: true,
      title: "Sign in to Microsoft",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let settled = false;

    const tryHandleUrl = (url: string) => {
      if (settled || !url.startsWith(REDIRECT_URI)) return;
      settled = true;

      const parsed = new URL(url);
      const error = parsed.searchParams.get("error");
      const returnedState = parsed.searchParams.get("state");
      const code = parsed.searchParams.get("code");

      if (error) {
        reject(new Error(`Microsoft sign-in failed: ${parsed.searchParams.get("error_description") ?? error}`));
      } else if (returnedState !== expectedState) {
        reject(new Error("Microsoft sign-in failed: state mismatch."));
      } else if (!code) {
        reject(new Error("Microsoft sign-in did not return an authorization code."));
      } else {
        resolve(code);
      }
      authWindow.close();
    };

    authWindow.webContents.on("will-redirect", (_event, url) => tryHandleUrl(url));
    authWindow.webContents.on("did-navigate", (_event, url) => tryHandleUrl(url));
    authWindow.on("closed", () => {
      if (!settled) {
        settled = true;
        reject(new Error("Microsoft sign-in was cancelled."));
      }
    });

    authWindow.loadURL(authUrl);
  });
}

async function authenticateXboxLive(msAccessToken: string): Promise<{ token: string; userHash: string }> {
  const response = await postJson("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `d=${msAccessToken}`,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  return { token: response.Token, userHash: response.DisplayClaims.xui[0].uhs };
}

async function authenticateXsts(xblToken: string): Promise<{ token: string; userHash: string }> {
  try {
    const response = await postJson("https://xsts.auth.xboxlive.com/xsts/authorize", {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    });
    return { token: response.Token, userHash: response.DisplayClaims.xui[0].uhs };
  } catch (err) {
    if (err instanceof HttpJsonError && err.status === 401 && err.body?.XErr) {
      const message = XSTS_ERROR_MESSAGES[String(err.body.XErr)];
      throw new Error(message ?? `Xbox Live sign-in failed (XErr ${err.body.XErr}).`);
    }
    throw err;
  }
}

async function loginWithXbox(userHash: string, xstsToken: string): Promise<{ access_token: string; expires_in: number }> {
  return await postJson("https://api.minecraftservices.com/authentication/login_with_xbox", {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  });
}

async function fetchProfile(mcAccessToken: string): Promise<{ id: string; name: string }> {
  const response = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });
  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This Microsoft account doesn't own Minecraft.");
    }
    throw new Error(`Failed to fetch Minecraft profile: ${json.errorMessage ?? response.statusText}`);
  }
  return json as { id: string; name: string };
}

async function completeMinecraftLogin(msAccessToken: string) {
  const xbl = await authenticateXboxLive(msAccessToken);
  const xsts = await authenticateXsts(xbl.token);
  const mc = await loginWithXbox(xsts.userHash, xsts.token);
  const profile = await fetchProfile(mc.access_token);

  return {
    mcAccessToken: mc.access_token,
    mcAccessTokenExpiresAt: Date.now() + mc.expires_in * 1000,
    username: profile.name,
    uuid: formatUuid(profile.id),
  };
}

/** Full interactive sign-in: opens a Microsoft login window, then walks the Xbox/XSTS/Minecraft chain. */
export async function loginInteractive(clientId: string, parentWindow: BrowserWindow): Promise<MicrosoftAccountResult> {
  if (!clientId.trim()) {
    throw new Error("No Microsoft sign-in client ID configured yet - add one in Settings (see README for how to register one).");
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "select_account");

  const code = await captureAuthorizationCode(authUrl.toString(), state, parentWindow);
  const msTokens = await postForm(TOKEN_URL, {
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
    scope: SCOPE,
  });
  const profile = await completeMinecraftLogin(msTokens.access_token);

  return { msRefreshToken: msTokens.refresh_token, ...profile };
}

/** Silently renews an account using its stored Microsoft refresh token - no window shown. */
export async function refreshAccount(clientId: string, refreshToken: string): Promise<MicrosoftAccountResult> {
  const msTokens = await postForm(TOKEN_URL, {
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  const profile = await completeMinecraftLogin(msTokens.access_token);

  // Microsoft may or may not rotate the refresh token on each use; fall back to the old one if not.
  return { msRefreshToken: msTokens.refresh_token ?? refreshToken, ...profile };
}
