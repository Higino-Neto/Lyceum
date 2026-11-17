/**
 * StarDict parsing without Node APIs (shared by desktop tests and the WebView
 * builds). Desktop imports the same `.idx`/`.dict` pairs into SQLite in
 * `electron/dictionary-storage.ts`; the rules here match it: big-endian
 * 32-bit offset/size, UTF-8 headwords, keys lowercased, first entry wins.
 */

export interface TarEntry {
  name: string;
  data: Uint8Array;
}

const decoder = new TextDecoder("utf-8");

function readString(bytes: Uint8Array, start: number, length: number) {
  const slice = bytes.subarray(start, start + length);
  const end = slice.indexOf(0);
  return decoder.decode(end >= 0 ? slice.subarray(0, end) : slice);
}

/** Minimal ustar/GNU tar reader (regular files only, long names supported). */
export function parseTar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longName: string | null = null;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = readString(header, 0, 100);
    const size = parseInt(readString(header, 124, 12).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readString(header, 345, 155);
    const dataStart = offset + 512;
    const data = bytes.subarray(dataStart, dataStart + size);
    if (type === "L") {
      longName = decoder.decode(data).replace(/\0+$/, "");
    } else if (type === "0" || type === "\0" || type === "7") {
      const fullName = longName ?? (prefix ? `${prefix}/${name}` : name);
      entries.push({ name: fullName, data });
      longName = null;
    } else {
      longName = null;
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function basename(name: string) {
  return name.split("/").pop() ?? name;
}

/**
 * Picks the `.idx` and `.dict` files of a StarDict release, preferring files
 * named after the dictionary id.
 */
export function pickStarDictFiles(entries: TarEntry[], dictId: string) {
  const pick = (pattern: RegExp) =>
    entries.find((entry) => pattern.test(basename(entry.name)) && basename(entry.name).startsWith(dictId))
    ?? entries.find((entry) => pattern.test(basename(entry.name)));
  const idx = pick(/\.idx(\.gz)?$/i);
  const dict = pick(/\.dict(\.dz)?$/i);
  return idx && dict ? { idx, dict } : null;
}

export function isGzipName(name: string) {
  return /\.(gz|dz)$/i.test(name);
}

/** Walks the index; `dict` must already be decompressed. Keys are lowercased like desktop. */
export function* readStarDictEntries(idx: Uint8Array, dict: Uint8Array): Generator<[word: string, content: string]> {
  const view = new DataView(idx.buffer, idx.byteOffset, idx.byteLength);
  let offset = 0;
  while (offset < idx.length) {
    const nul = idx.indexOf(0, offset);
    if (nul === -1) break;
    const word = decoder.decode(idx.subarray(offset, nul));
    const dataStart = nul + 1;
    if (dataStart + 8 > idx.length) break;
    const position = view.getUint32(dataStart, false);
    const size = view.getUint32(dataStart + 4, false);
    offset = dataStart + 8;
    if (position + size > dict.length) break;
    yield [word.toLowerCase(), decoder.decode(dict.subarray(position, position + size))];
  }
}

/** Same normalization as the desktop lookup engine (`electron/lemmatizer.ts#normalizeWord`). */
export function normalizeLookupWord(word: string): string {
  return word.normalize("NFKC").replace(/['‘’`]/g, "").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase();
}
