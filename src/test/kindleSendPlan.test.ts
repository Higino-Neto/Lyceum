import { describe, expect, it } from "vitest";
import {
  isEmailPlanSendable,
  maxAttachmentBytesForMessage,
  maxEmailAttachmentBytes,
  planEmailBook,
  planUsbBook,
} from "../features/kindle/kindleSendPlan";

const MB = 1024 * 1024;
const email = { pdfAsEpub: false, compressImages: false, maxBytes: 18 * MB };

describe("Kindle send plan", () => {
  it("accounts for base64 when sizing e-mail attachments", () => {
    // A 25 MB message limit only fits ~18.7 MB of file...
    expect(maxAttachmentBytesForMessage(25 * MB)).toBeLessThan(19 * MB);
    expect(maxAttachmentBytesForMessage(25 * MB) * (4 / 3)).toBeLessThan(25 * MB);
    // ...but Gmail caps the file itself at 25 MB (its transports take 35 MB encoded).
    expect(maxEmailAttachmentBytes("gmail")).toBe(25 * MB);
    expect(maxEmailAttachmentBytes("outlook")).toBe(maxAttachmentBytesForMessage(20 * MB));
    expect(maxEmailAttachmentBytes("custom")).toBe(maxAttachmentBytesForMessage(50 * MB));
  });

  it("converts Kindle-only formats to EPUB for e-mail instead of refusing them", () => {
    expect(planEmailBook("azw3", MB, email)).toMatchObject({ action: "convert", target: "epub" });
    expect(planEmailBook("mobi", MB, email)).toMatchObject({ action: "convert", target: "epub" });
    expect(planEmailBook("cbz", MB, email)).toMatchObject({ action: "convert", target: "pdf" });
    expect(planEmailBook("kfx", MB, email)).toEqual({ action: "unsupported", reason: "kfx-email" });
  });

  it("blocks oversized files unless images can be shrunk", () => {
    const big = 30 * MB;
    const epub = planEmailBook("epub", big, email);
    expect(epub).toEqual({ action: "send", target: "epub", tooLarge: true });
    expect(isEmailPlanSendable(epub)).toBe(false);
    expect(planEmailBook("epub", big, { ...email, compressImages: true })).toMatchObject({ action: "convert", target: "epub", rebuild: true });
    // A PDF can't be shrunk losslessly here; converting it to EPUB is the user's call.
    expect(planEmailBook("pdf", big, { ...email, compressImages: true })).toMatchObject({ action: "send", tooLarge: true });
    expect(planEmailBook("pdf", big, { ...email, pdfAsEpub: true })).toMatchObject({ action: "convert", target: "epub" });
  });

  it("plans USB copies and conversions", () => {
    expect(planUsbBook("epub", { convertToAzw3: true })).toEqual({ action: "convert", target: "azw3" });
    expect(planUsbBook("docx", { convertToAzw3: true })).toEqual({ action: "convert", target: "azw3" });
    expect(planUsbBook("azw3", { convertToAzw3: true })).toEqual({ action: "copy", target: "azw3" });
    expect(planUsbBook("pdf", { convertToAzw3: false })).toEqual({ action: "copy", target: "pdf" });
    expect(planUsbBook("epub", { convertToAzw3: false })).toEqual({ action: "unsupported", reason: "needs-azw3" });
    expect(planUsbBook("xyz", { convertToAzw3: true })).toEqual({ action: "unsupported", reason: "unsupported-format" });
  });
});
