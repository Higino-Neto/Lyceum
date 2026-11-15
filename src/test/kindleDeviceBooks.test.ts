// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readKfxMetadata } from "../lib/lyceum/kfx/kfxMetadataReader";
import { buildAzw3 } from "../lib/lyceum/mobi/azw3Writer";
import {
  findKindleSystemThumbnail,
  inspectKindleBook,
  stripKindleFileNameSuffix,
} from "../../electron/services/kindle-book-inspector";
import {
  gvfsMountPathForMtpRoot,
  isGvfsMtpPath,
  parseGioMtpEreaderVolumes,
} from "../../electron/services/linux-mtp";

// --- Minimal Ion binary encoder, enough to build a synthetic KFX file. ---
function varUInt(value: number): number[] {
  const bytes = [value & 0x7f];
  let rest = Math.floor(value / 128);
  while (rest > 0) {
    bytes.unshift(rest & 0x7f);
    rest = Math.floor(rest / 128);
  }
  bytes[bytes.length - 1] |= 0x80;
  return bytes;
}
function typed(type: number, body: number[]): number[] {
  return body.length < 14 ? [(type << 4) | body.length, ...body] : [(type << 4) | 14, ...varUInt(body.length), ...body];
}
function uintBytes(value: number): number[] {
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest & 0xff);
  return bytes;
}
const ion = {
  int: (value: number) => typed(2, uintBytes(value)),
  sym: (id: number) => typed(7, uintBytes(id)),
  str: (value: string) => typed(8, Array.from(Buffer.from(value, "utf8"))),
  list: (items: number[][]) => typed(11, items.flat()),
  struct: (fields: Array<[number, number[]]>) => typed(13, fields.flatMap(([id, value]) => [...varUInt(id), ...value])),
  annotated: (annotations: number[], value: number[]) => {
    const annotationBytes = annotations.flatMap(varUInt);
    return typed(14, [...varUInt(annotationBytes.length), ...annotationBytes, ...value]);
  },
};
const BVM = [0xe0, 0x01, 0x00, 0xea];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 0xff, 0xd9];

/**
 * CONT header + local symbol table + index table, then three entities:
 * metadata (categorised key/value pairs), external resource, raw JPEG.
 * Local symbols (shared table imports 100 ids): 110 "cover-res",
 * 111 "resource/rsrc1", 112 "book-meta".
 */
function buildSyntheticKfx(): Uint8Array {
  const symbolTable = [...BVM, ...ion.annotated([3], ion.struct([
    [6, ion.list([ion.struct([[4, ion.str("YJ_symbols")], [8, ion.int(100)]])])],
    [7, ion.list([ion.str("cover-res"), ion.str("resource/rsrc1"), ion.str("book-meta")])],
  ]))];
  const pair = (key: string, value: number[]) => ion.struct([[50, ion.str(key)], [51, value]]);
  const metadata = [...BVM, ...ion.struct([[60, ion.list([ion.struct([
    [61, ion.str("kindle_title_metadata")],
    [62, ion.list([
      pair("title", ion.str("Livro Sintético")),
      pair("author", ion.str("Ana Autora")),
      pair("author", ion.str("Bruno Autor")),
      pair("language", ion.str("pt")),
      pair("ASIN", ion.str("ABCDEF0123456789ABCDEF0123456789")),
      pair("cde_content_type", ion.str("PDOC")),
      pair("cover_image", ion.sym(110)),
    ])],
  ])])]])];
  const resource = [...BVM, ...ion.struct([[70, ion.str("resource/rsrc1")], [71, ion.str("jpg")]])];
  const payloads: Array<{ id: number; type: number; data: number[] }> = [
    { id: 112, type: 90, data: metadata },
    { id: 110, type: 91, data: resource },
    { id: 111, type: 92, data: JPEG },
  ];
  const entityRecords = payloads.map((payload) => {
    const header = Buffer.alloc(10);
    header.write("ENTY", 0, "latin1");
    header.writeUInt16LE(1, 4);
    header.writeUInt32LE(10, 6);
    return Buffer.concat([header, Buffer.from(payload.data)]);
  });

  const fixedHeader = 18;
  const symbolsOffset = fixedHeader;
  const indexLength = payloads.length * 24;
  // Container info: index offset/length pair, filled once offsets are known.
  const buildInfo = (indexOffset: number) => Buffer.from([...BVM, ...ion.struct([[20, ion.int(indexOffset)], [21, ion.int(indexLength)]])]);
  const infoOffset = symbolsOffset + symbolTable.length;
  // Ion ints are variable-length: iterate until the index offset is stable.
  let indexOffset = infoOffset;
  let info = buildInfo(indexOffset);
  while (infoOffset + info.length !== indexOffset) {
    indexOffset = infoOffset + info.length;
    info = buildInfo(indexOffset);
  }
  const headerLength = indexOffset + indexLength;

  const index = Buffer.alloc(indexLength);
  let relative = 0;
  payloads.forEach((payload, position) => {
    index.writeUInt32LE(payload.id, position * 24);
    index.writeUInt32LE(payload.type, position * 24 + 4);
    index.writeBigUInt64LE(BigInt(relative), position * 24 + 8);
    index.writeBigUInt64LE(BigInt(entityRecords[position].length), position * 24 + 16);
    relative += entityRecords[position].length;
  });

  const head = Buffer.alloc(fixedHeader);
  head.write("CONT", 0, "latin1");
  head.writeUInt16LE(2, 4);
  head.writeUInt32LE(headerLength, 6);
  head.writeUInt32LE(infoOffset, 10);
  head.writeUInt32LE(info.length, 14);
  return new Uint8Array(Buffer.concat([head, Buffer.from(symbolTable), info, index, ...entityRecords]));
}

describe("KFX metadata reader", () => {
  it("reads title, authors, ASIN and the cover from a KFX container", () => {
    const metadata = readKfxMetadata(buildSyntheticKfx());
    expect(metadata.title).toBe("Livro Sintético");
    expect(metadata.author).toBe("Ana Autora & Bruno Autor");
    expect(metadata.authors).toEqual(["Ana Autora", "Bruno Autor"]);
    expect(metadata.language).toBe("pt");
    expect(metadata.asin).toBe("ABCDEF0123456789ABCDEF0123456789");
    expect(metadata.cdeType).toBe("PDOC");
    expect(Array.from(metadata.coverImage || [])).toEqual(JPEG);
    expect(metadata.coverMediaType).toBe("image/jpeg");
  });

  it("rejects files that are not KFX containers", () => {
    expect(() => readKfxMetadata(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toThrow(/DRM/);
    expect(() => readKfxMetadata(new Uint8Array(32))).toThrow(/CONT/);
  });
});

describe("Kindle device books", () => {
  it("strips the ASIN/GUID suffix Kindle adds to file names", () => {
    expect(stripKindleFileNameSuffix("Dom Quixote_E9DE6FA5C459482D82071164E8FD6CC5")).toBe("Dom Quixote");
    expect(stripKindleFileNameSuffix("Dicionário Priberam_B0050BXW8Q")).toBe("Dicionário Priberam");
    expect(stripKindleFileNameSuffix("One_Piece_22")).toBe("One_Piece_22");
  });

  it("inspects AZW3 metadata and cover, and KFX through partial reads", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-device-"));
    const kfxPath = path.join(dir, "livro_ABCDEF0123456789ABCDEF0123456789.kfx");
    fs.writeFileSync(kfxPath, buildSyntheticKfx());
    const kfx = await inspectKindleBook({ filePath: kfxPath, fileType: "kfx", thumbnailPath: path.join(dir, "kfx.webp") });
    expect(kfx.details).toMatchObject({ title: "Livro Sintético", author: "Ana Autora & Bruno Autor", asin: "ABCDEF0123456789ABCDEF0123456789" });

    const azw3Path = path.join(dir, "livro.azw3");
    const chapter = { id: "c1", href: "c1.xhtml", title: "Um", xhtml: "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>Texto.</p></body></html>" };
    fs.writeFileSync(azw3Path, Buffer.from(buildAzw3({
      metadata: { title: "Meu AZW3", author: "Clara Escritora", language: "pt-BR", asin: "B000TEST01", publisher: "Editora X" },
      textual: { chapters: [chapter], spine: [chapter], toc: [{ ...chapter, level: 1 }], fulltext: "Texto." },
    }).buffer));
    const azw3 = await inspectKindleBook({ filePath: azw3Path, fileType: "azw3", thumbnailPath: path.join(dir, "azw3.webp") });
    expect(azw3.details).toMatchObject({ title: "Meu AZW3", author: "Clara Escritora", publisher: "Editora X", asin: "B000TEST01", cdeType: "EBOK" });
  });

  it("finds the cover thumbnail the Kindle keeps in system/thumbnails", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lyceum-kindle-root-"));
    fs.mkdirSync(path.join(root, "system", "thumbnails"), { recursive: true });
    const thumb = path.join(root, "system", "thumbnails", "thumbnail_B0050BXW8Q_EBOK_portrait.jpg");
    fs.writeFileSync(thumb, Buffer.from(JPEG));
    expect(findKindleSystemThumbnail(root, "B0050BXW8Q")).toBe(thumb);
    expect(findKindleSystemThumbnail(root, "MISSING")).toBeUndefined();
    expect(findKindleSystemThumbnail(undefined, "B0050BXW8Q")).toBeUndefined();
  });
});

describe("Linux MTP e-readers", () => {
  const gioOutput = `Drive(0): Samsung SSD
  Type: GProxyDrive (GProxyVolumeMonitorUDisks2)
Volume(0): Kindle Paperwhite
  Type: GProxyVolume (GProxyVolumeMonitorMTP)
  ids:
   unix-device: '/dev/bus/usb/003/029'
  activation_root=mtp://Amazon_Kindle_Paperwhite_GR733X01542305JD/
  can_mount=1
  should_automount=1
Volume(1): Pixel 8
  Type: GProxyVolume (GProxyVolumeMonitorMTP)
  activation_root=mtp://Google_Pixel_8_1234/
  can_mount=1
`;

  it("finds MTP Kindles in gio output and ignores phones", () => {
    expect(parseGioMtpEreaderVolumes(gioOutput)).toEqual([
      { name: "Kindle Paperwhite", activationRoot: "mtp://Amazon_Kindle_Paperwhite_GR733X01542305JD/" },
    ]);
  });

  it("maps activation roots to gvfs paths", () => {
    expect(gvfsMountPathForMtpRoot("mtp://Amazon_Kindle_Paperwhite_GR733X01542305JD/", 1000))
      .toBe("/run/user/1000/gvfs/mtp:host=Amazon_Kindle_Paperwhite_GR733X01542305JD");
    expect(isGvfsMtpPath("/run/user/1000/gvfs/mtp:host=Kindle/Internal Storage/documents/a.azw3")).toBe(true);
    expect(isGvfsMtpPath("/run/media/user/Kindle/documents/a.azw3")).toBe(false);
  });
});

describe("Kindle image preparation", () => {
  it("turns opaque RGBA page renders into JPEG within the size budget", async () => {
    const sharp = (await import("sharp")).default;
    const { prepareKindleImages } = await import("../lib/lyceum/mobi/records/resources");
    const noisy = Buffer.alloc(1200 * 1700 * 4);
    for (let index = 0; index < noisy.length; index += 1) noisy[index] = index % 4 === 3 ? 255 : (index * 2654435761) >>> 24;
    const png = await sharp(noisy, { raw: { width: 1200, height: 1700, channels: 4 } }).png().toBuffer();
    const transparent = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const prepared = await prepareKindleImages({
      rootPath: os.tmpdir(),
      manifest: {} as never,
      metadata: { title: "x" },
      textual: {
        chapters: [], spine: [], toc: [], fulltext: "",
        resources: [
          { id: "page", href: "images/page.png", mediaType: "image/png", data: png },
          { id: "logo", href: "images/logo.png", mediaType: "image/png", data: transparent },
        ],
      },
    }, "kindle-compatible");
    const [page, logo] = prepared.pkg.textual!.resources!;
    expect(page.mediaType).toBe("image/jpeg");
    expect((page.data as Uint8Array).length).toBeLessThanOrEqual(1536 * 1024);
    expect(logo.mediaType).toBe("image/png");
  });
});
