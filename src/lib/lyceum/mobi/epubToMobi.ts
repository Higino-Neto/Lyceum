import JSZip from "jszip";

export interface MobiConversionOptions {
  title: string;
  author?: string;
}

export interface MobiConversionResult {
  buffer: ArrayBuffer;
  report: {
    warnings: string[];
    chapterCount: number;
  };
}

function dateToPdbTime(date: Date): number {
  const epoch = new Date(1904, 0, 1).getTime();
  return Math.floor((date.getTime() - epoch) / 1000);
}

function writePdbHeader(
  buffer: Uint8Array,
  title: string,
  numRecords: number,
): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  for (let i = 0; i < 31 && i < title.length; i++) {
    buffer[offset++] = title.charCodeAt(i);
  }
  for (let i = title.length; i < 32; i++) {
    buffer[offset++] = 0;
  }

  view.setUint16(offset, 0, false);
  offset += 2;
  view.setUint16(offset, 0, false);
  offset += 2;

  view.setUint32(offset, dateToPdbTime(new Date()), false);
  offset += 4;
  view.setUint32(offset, dateToPdbTime(new Date()), false);
  offset += 4;
  view.setUint32(offset, dateToPdbTime(new Date()), false);
  offset += 4;

  view.setUint32(offset, 0, false);
  offset += 4;
  view.setUint32(offset, 0, false);
  offset += 4;

  for (let i = 0; i < 8; i++) {
    buffer[offset++] = "BOOKMOBI".charCodeAt(i);
  }

  view.setUint32(offset, 0, false);
  offset += 4;
  view.setUint16(offset, 0, false);
  offset += 2;
  view.setUint16(offset, 0, false);
  offset += 2;

  const recordListOffset = offset;
  offset = 78;

  const record0Offset = 78 + numRecords * 8;
  view.setUint32(recordListOffset, record0Offset, false);
  view.setUint32(recordListOffset + 4, 0, false);
}

function writeNullTerminatedString(buffer: Uint8Array, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    buffer[offset++] = str.charCodeAt(i);
  }
  buffer[offset++] = 0;
  return offset;
}

async function extractEpubContent(epubBuffer: ArrayBuffer): Promise<{
  title: string;
  author: string;
  chapters: { title: string; content: string }[];
}> {
  const zip = await JSZip.loadAsync(epubBuffer);

  let title = "Untitled";
  let author = "Unknown";
  const chapters: { title: string; content: string }[] = [];

  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  let opfPath = "OEBPS/content.opf";

  if (containerXml) {
    const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/);
    if (rootfileMatch) {
      opfPath = rootfileMatch[1];
    }
  }

  const opfXml = await zip.file(opfPath)?.async("string");
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

  if (opfXml) {
    const titleMatch = opfXml.match(/<dc:title>([^<]*)<\/dc:title>/i);
    if (titleMatch) title = titleMatch[1];

    const creatorMatch = opfXml.match(/<dc:creator>([^<]*)<\/dc:creator>/i);
    if (creatorMatch) author = creatorMatch[1];

    const itemRefs = opfXml.match(/<itemref[^>]*idref=["']([^"']+)["']/gi);
    if (itemRefs) {
      for (const itemRef of itemRefs) {
        const idrefMatch = itemRef.match(/idref=["']([^"']+)["']/);
        if (idrefMatch) {
          const idref = idrefMatch[1];
          const itemMatch = opfXml.match(new RegExp(`<item[^>]*id=["']${idref}["'][^>]*href=["']([^"']+)["']`));
          if (itemMatch) {
            const href = itemMatch[1];
            const fullPath = opfDir + href;
            const content = await zip.file(fullPath)?.async("string");
            if (content) {
              const textContent = content
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();

              chapters.push({
                title: `Chapter ${chapters.length + 1}`,
                content: textContent,
              });
            }
          }
        }
      }
    }
  }

  if (chapters.length === 0) {
    const allTextFiles = zip.filter((_, file) => {
      return (
        file.name.endsWith(".xhtml") ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".htm")
      );
    });

    for (const file of allTextFiles) {
      const content = await file.async("string");
      if (content) {
        const textContent = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (textContent.length > 100) {
          chapters.push({
            title: `Chapter ${chapters.length + 1}`,
            content: textContent,
          });
        }
      }
    }
  }

  return { title, author, chapters };
}

export async function convertEpubToMobi(
  epubBuffer: ArrayBuffer,
  options: MobiConversionOptions,
): Promise<ArrayBuffer> {
  const content = await extractEpubContent(epubBuffer);
  const title = options.title || content.title;
  const author = options.author || content.author;

  const allText = content.chapters.map((c) => c.content).join("\n\n");

  const textBuffer = new TextEncoder().encode(
    `${title}\n\n${author}\n\n${allText}`,
  );

  const headerSize = 78 + 16 + 264 + 200;
  const totalSize = headerSize + textBuffer.length + 2;

  const buffer = new Uint8Array(totalSize);
  buffer.fill(0);

  writePdbHeader(buffer, title.substring(0, 31), 1);

  let offset = 78 + 8;

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  view.setUint16(offset, textBuffer.length + 1, false);
  offset += 2;
  view.setUint16(offset, 0, false);
  offset += 2;
  view.setUint32(offset, 4096, false);
  offset += 4;
  view.setUint16(offset, 0, false);
  offset += 2;
  view.setUint16(offset, 12, false);
  offset += 2;

  view.setUint32(offset, headerSize - 16, false);
  offset += 4;
  view.setUint32(offset, textBuffer.length, false);
  offset += 4;

  offset = writeNullTerminatedString(buffer, 16 + 20, "MOBI");

  offset = headerSize;
  buffer.set(textBuffer, offset);
  buffer[offset + textBuffer.length] = 0;

  return buffer.buffer;
}
