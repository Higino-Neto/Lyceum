// @vitest-environment node

import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GMAIL_SEND_SCOPE, signInWithGoogle } from "./google-oauth";

function idToken(email: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ email })}.sig`;
}

function hit(url: string) {
  return new Promise<number>((resolve, reject) => {
    http.get(url, (response) => { response.resume(); resolve(response.statusCode || 0); }).on("error", reject);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInWithGoogle", () => {
  it("runs the PKCE loopback flow and returns the account email", async () => {
    const tokenRequests: URLSearchParams[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
      tokenRequests.push(init.body);
      return new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600, id_token: idToken("me@gmail.com") }));
    }));

    let authUrl: URL | undefined;
    const tokens = await signInWithGoogle({ clientId: "client-id" }, async (url) => {
      authUrl = new URL(url);
      const redirect = new URL(authUrl.searchParams.get("redirect_uri")!);
      redirect.searchParams.set("code", "auth-code");
      redirect.searchParams.set("state", authUrl.searchParams.get("state")!);
      expect(await hit(redirect.toString())).toBe(200);
    });

    expect(authUrl!.searchParams.get("scope")).toContain(GMAIL_SEND_SCOPE);
    expect(authUrl!.searchParams.get("code_challenge_method")).toBe("S256");
    expect(tokenRequests[0]!.get("code")).toBe("auth-code");
    expect(tokenRequests[0]!.get("code_verifier")).toBeTruthy();
    expect(tokens).toMatchObject({ accessToken: "access", refreshToken: "refresh", email: "me@gmail.com" });
  });

  it("rejects a redirect with the wrong state", async () => {
    await expect(signInWithGoogle({ clientId: "client-id" }, async (url) => {
      const redirect = new URL(new URL(url).searchParams.get("redirect_uri")!);
      redirect.searchParams.set("code", "auth-code");
      redirect.searchParams.set("state", "forged");
      await hit(redirect.toString());
    })).rejects.toThrow();
  });
});
