import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Google sign-in for desktop apps: authorization code + PKCE with a loopback
 * redirect (https://developers.google.com/identity/protocols/oauth2/native-app).
 * Only the `gmail.send` scope is requested — Lyceum can send mail as the user
 * but cannot read the mailbox.
 */

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;

export interface GoogleOAuthClient {
  clientId: string;
  /** Desktop clients get a secret that Google documents as non-confidential; it is still required by the token endpoint. */
  clientSecret?: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeIdTokenEmail(idToken: string | undefined) {
  const payload = idToken?.split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as { email?: string; email_verified?: boolean };
    return claims.email;
  } catch {
    return undefined;
  }
}

async function postForm(url: string, body: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) if (value) params.set(key, value);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const description = String(json.error_description || json.error || response.statusText);
    const error = new Error(description) as Error & { oauthError?: string };
    error.oauthError = typeof json.error === "string" ? json.error : undefined;
    throw error;
  }
  return json;
}

function toTokens(json: Record<string, unknown>): GoogleTokens {
  return {
    accessToken: String(json.access_token || ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000,
    email: decodeIdTokenEmail(typeof json.id_token === "string" ? json.id_token : undefined),
  };
}

const RESULT_PAGE = (title: string, message: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f5f2;color:#222}
main{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.25rem}</style></head>
<body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

/**
 * Opens the browser on Google's consent screen and waits for the redirect on
 * a one-shot localhost server.
 */
export async function signInWithGoogle(
  client: GoogleOAuthClient,
  openBrowser: (url: string) => Promise<void> | void,
  options: { loginHint?: string; signal?: AbortSignal } = {},
): Promise<GoogleTokens> {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64Url(crypto.randomBytes(16));

  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Tempo esgotado esperando o login no navegador.")), SIGN_IN_TIMEOUT_MS);
      options.signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Login cancelado."));
      });

      server.on("request", (request, response) => {
        const url = new URL(request.url || "/", redirectUri);
        if (url.pathname !== "/") {
          response.writeHead(404).end();
          return;
        }
        const error = url.searchParams.get("error");
        const returnedCode = url.searchParams.get("code");
        const ok = !error && returnedCode && url.searchParams.get("state") === state;
        response.writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(ok
          ? RESULT_PAGE("Conta conectada", "Pronto! Você já pode fechar esta aba e voltar ao Lyceum.")
          : RESULT_PAGE("Login não concluído", "A autorização foi cancelada ou falhou. Volte ao Lyceum e tente de novo."));
        clearTimeout(timeout);
        if (ok) resolve(returnedCode);
        else reject(new Error(error === "access_denied" ? "Autorização negada no navegador." : `Login falhou: ${error || "resposta invalida"}`));
      });

      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.search = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: `openid email ${GMAIL_SEND_SCOPE}`,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        access_type: "offline",
        prompt: "consent",
        ...(options.loginHint ? { login_hint: options.loginHint } : {}),
      }).toString();
      void Promise.resolve(openBrowser(authUrl.toString())).catch((openError) => {
        clearTimeout(timeout);
        reject(openError);
      });
    });

    const tokens = toTokens(await postForm(TOKEN_ENDPOINT, {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }));
    if (!tokens.refreshToken) throw new Error("O Google nao devolveu um token de atualizacao. Tente conectar de novo.");
    return tokens;
  } finally {
    server.close();
  }
}

export async function refreshGoogleAccessToken(client: GoogleOAuthClient, refreshToken: string): Promise<GoogleTokens> {
  try {
    const tokens = toTokens(await postForm(TOKEN_ENDPOINT, {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }));
    return { ...tokens, refreshToken: tokens.refreshToken || refreshToken };
  } catch (error) {
    if ((error as { oauthError?: string }).oauthError === "invalid_grant") {
      throw new Error("A autorizacao do Google expirou ou foi revogada. Conecte a conta Google novamente.");
    }
    throw error;
  }
}

export async function revokeGoogleToken(token: string) {
  await postForm(REVOKE_ENDPOINT, { token }).catch(() => undefined);
}

/** Sends a complete RFC 822 message through the Gmail API (media upload accepts up to 35 MB). */
export async function sendGmailRawMessage(accessToken: string, rawMessage: Buffer) {
  const response = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "message/rfc822" },
    body: new Uint8Array(rawMessage),
  });
  const json = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string; status?: string } };
  if (!response.ok) {
    const message = json.error?.message || response.statusText;
    const error = new Error(`Gmail recusou o envio: ${message}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return json.id;
}
