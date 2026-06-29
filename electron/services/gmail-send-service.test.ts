import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GmailKindleService,
  buildGmailRawEpubMessage,
  validateKindleEmail,
  type SafeTokenStorage,
} from "./gmail-send-service";

const fakeSafeStorage: SafeTokenStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (plainText) => Buffer.from(plainText, "utf8"),
  decryptString: (encrypted) => encrypted.toString("utf8"),
};

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-gmail-test-"));
}

describe("gmail-send-service", () => {
  it("validates Kindle addresses narrowly", () => {
    expect(validateKindleEmail(" User@Kindle.com ")).toEqual({
      valid: true,
      email: "user@kindle.com",
    });
    expect(validateKindleEmail("user@gmail.com").valid).toBe(false);
    expect(validateKindleEmail("bad-address").valid).toBe(false);
  });

  it("builds a Gmail raw MIME message with an EPUB attachment", () => {
    const tempDir = makeTempDir();
    const epubPath = path.join(tempDir, "Livro.epub");
    fs.writeFileSync(epubPath, Buffer.from("epub-bytes", "utf8"));

    const raw = buildGmailRawEpubMessage({
      to: "user@kindle.com",
      filePath: epubPath,
      fileName: "Livro.epub",
      title: "Livro",
    });

    const decoded = Buffer.from(
      raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");

    expect(decoded).toContain("To: user@kindle.com");
    expect(decoded).toContain("Content-Type: application/epub+zip");
    expect(decoded).toContain("Content-Disposition: attachment");
    expect(decoded).toContain(Buffer.from("epub-bytes").toString("base64"));
  });

  it("reports missing OAuth client configuration without exposing token fields", () => {
    const service = new GmailKindleService({
      userDataPath: makeTempDir(),
      appRoot: makeTempDir(),
      safeStorage: fakeSafeStorage,
      openExternal: async () => undefined,
      env: {
        APP_ROOT: "",
        VITE_PUBLIC: "",
      },
    });

    expect(service.getStatus()).toMatchObject({
      configured: false,
      connected: false,
      encryptionAvailable: true,
      kindleEmail: null,
    });
  });
});
