// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KindleEmailService, classifySmtpError, isKindleAddress, type SecretStore } from "./kindle-email";

let tempDir: string | null = null;

function configPath() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-kindle-email-"));
  return path.join(tempDir, "kindle-email.json");
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

const reversibleStore: SecretStore = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`enc:${value}`),
  decryptString: (value) => value.toString().replace(/^enc:/, ""),
};

const noKeychain: SecretStore = {
  isEncryptionAvailable: () => false,
  encryptString: () => { throw new Error("unavailable"); },
  decryptString: () => { throw new Error("unavailable"); },
};

describe("KindleEmailService", () => {
  it("applies provider presets and keeps the stored password when none is sent", () => {
    const file = configPath();
    const service = new KindleEmailService(file, reversibleStore);
    service.save({ kindleAddress: "me_1@kindle.com", senderAddress: "me@gmail.com", provider: "gmail", password: "app-pass" });
    const config = service.save({ kindleAddress: "other@kindle.com" });

    expect(config).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, username: "me@gmail.com", hasPassword: true, configured: true });
    expect(fs.readFileSync(file, "utf8")).not.toContain("app-pass");
  });

  it("never writes the password to disk without a keychain", () => {
    const file = configPath();
    const service = new KindleEmailService(file, noKeychain);
    const config = service.save({ kindleAddress: "me@kindle.com", senderAddress: "me@example.com", provider: "custom", host: "smtp.example.com", port: 587, password: "secret" });

    expect(config).toMatchObject({ hasPassword: true, passwordPersisted: false, configured: true });
    expect(fs.readFileSync(file, "utf8")).not.toContain("secret");
    expect(new KindleEmailService(file, noKeychain).getPublicConfig().hasPassword).toBe(false);
  });

  it("strips the spaces Google shows inside app passwords", () => {
    let stored = "";
    const store: SecretStore = { ...reversibleStore, encryptString: (value) => { stored = value; return Buffer.from(value); } };
    new KindleEmailService(configPath(), store).save({ senderAddress: "me@gmail.com", provider: "gmail", password: "abcd efgh ijkl mnop" });
    expect(stored).toBe("abcdefghijklmnop");
  });

  it("rejects malformed addresses", () => {
    const service = new KindleEmailService(configPath(), reversibleStore);
    expect(() => service.save({ kindleAddress: "not-an-email" })).toThrow();
  });

  it("recognizes Kindle addresses and explains auth failures", () => {
    expect(isKindleAddress("x@kindle.com")).toBe(true);
    expect(isKindleAddress("x@free.kindle.com")).toBe(true);
    expect(isKindleAddress("x@gmail.com")).toBe(false);
    expect(classifySmtpError({ code: "EAUTH" }).code).toBe("smtp-auth");
    expect(classifySmtpError({ code: "EAUTH", responseCode: 534, response: "534-5.7.9 Application-specific password required" }).code).toBe("smtp-app-password");
    expect(classifySmtpError({ code: "ETIMEDOUT" })).toMatchObject({ code: "smtp-connection", params: { code: "ETIMEDOUT" } });
    expect(classifySmtpError({ responseCode: 552, response: "552 Message size exceeds" }).code).toBe("smtp-too-large");
  });
});

describe("Google sign-in configuration", () => {
  it("only offers Google sign-in when a client id is bundled and keeps the sender locked to the account", () => {
    const file = configPath();
    expect(new KindleEmailService(file, reversibleStore).getPublicConfig().googleSignInAvailable).toBe(false);

    fs.writeFileSync(file, JSON.stringify({
      kindleAddress: "me@kindle.com", senderAddress: "acct@gmail.com", provider: "gmail", authMethod: "google",
      encryptedRefreshToken: Buffer.from("enc:refresh").toString("base64"),
    }));
    const service = new KindleEmailService(file, reversibleStore, { googleClient: { clientId: "id.apps.googleusercontent.com" }, openBrowser: () => undefined });
    expect(service.getPublicConfig()).toMatchObject({ googleSignInAvailable: true, googleConnected: true, configured: true, maxAttachmentBytes: 25 * 1024 * 1024 });

    const saved = service.save({ kindleAddress: "other@kindle.com", senderAddress: "spoof@gmail.com", authMethod: "google" });
    expect(saved.senderAddress).toBe("acct@gmail.com");
  });
});
