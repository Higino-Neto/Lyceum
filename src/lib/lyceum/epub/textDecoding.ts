/** Encoding detection for text files and EPUB parts (no Node or DOM APIs). */
function detectBomEncoding(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  return null;
}

function detectDeclaredEncoding(bytes: Uint8Array): string | null {
  const asciiPrefix = Array.from(bytes.slice(0, 256))
    .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : " "))
    .join("");
  return asciiPrefix.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i)?.[1] || null;
}

function detectUtf16WithoutBom(bytes: Uint8Array): string | null {
  const sample = bytes.slice(0, Math.min(bytes.length, 512));
  if (sample.length < 8) return null;
  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < sample.length; index += 1) {
    if (sample[index] !== 0) continue;
    if (index % 2 === 0) evenNulls += 1;
    else oddNulls += 1;
  }
  const pairs = Math.floor(sample.length / 2);
  if (oddNulls / pairs > 0.3 && evenNulls / pairs < 0.05) return "utf-16le";
  if (evenNulls / pairs > 0.3 && oddNulls / pairs < 0.05) return "utf-16be";
  return null;
}

export function decodeTextBytes(bytes: Uint8Array | ArrayBuffer, fallback = "utf-8") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const encoding = detectBomEncoding(data) || detectDeclaredEncoding(data) || detectUtf16WithoutBom(data) || fallback;

  try {
    const decoded = new TextDecoder(encoding, { fatal: false }).decode(data);
    if (encoding.toLowerCase() === "utf-8" && (decoded.match(/\ufffd/g)?.length || 0) > Math.max(2, decoded.length * 0.005)) {
      return new TextDecoder("windows-1252", { fatal: false }).decode(data);
    }
    return decoded.replace(/^\ufeff/, "");
  } catch {
    return new TextDecoder(fallback, { fatal: false }).decode(data).replace(/^\ufeff/, "");
  }
}
