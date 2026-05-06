import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseInternalEpub,
  releaseInternalEpubResources,
} from "../pages/ReadingPage/components/epub-reader/internal-engine/epubParser";

async function buildMinimalEpub() {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
      </rootfiles>
    </container>`,
  );
  zip.file(
    "OPS/package.opf",
    `<?xml version="1.0"?>
    <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Livro de Teste</dc:title>
      </metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
        <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" />
        <item id="style" href="style.css" media-type="text/css" />
        <item id="cover" href="cover.png" media-type="image/png" />
      </manifest>
      <spine>
        <itemref idref="chapter" />
      </spine>
    </package>`,
  );
  zip.file(
    "OPS/nav.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml">
      <body>
        <nav epub:type="toc">
          <ol>
            <li><a href="chapter.xhtml#start">Inicio</a></li>
          </ol>
        </nav>
      </body>
    </html>`,
  );
  zip.file(
    "OPS/chapter.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml">
      <body>
        <h1 id="start">Inicio</h1>
        <p onclick="alert('x')">
          Hello reader
          <a href="chapter.xhtml#next">next</a>
          <img src="cover.png" />
          <script>window.bad = true</script>
        </p>
      </body>
    </html>`,
  );
  zip.file("OPS/style.css", "p { background: url('cover.png'); }");
  zip.file("OPS/cover.png", new Uint8Array([137, 80, 78, 71]));

  return zip.generateAsync({ type: "arraybuffer" });
}

describe("parseInternalEpub", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test-resource"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  it("parses spine, toc, assets, and sanitized chapter html", async () => {
    const book = await parseInternalEpub(await buildMinimalEpub());

    expect(book.title).toBe("Livro de Teste");
    expect(book.toc[0]).toMatchObject({
      label: "Inicio",
      href: "OPS/chapter.xhtml#start",
    });
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].href).toBe("OPS/chapter.xhtml");
    expect(book.chapters[0].text).toContain("Hello reader");
    expect(book.chapters[0].html).not.toContain("script");
    expect(book.chapters[0].html).not.toContain("onclick");
    expect(book.chapters[0].html).toContain('data-epub-href="OPS/chapter.xhtml#next"');
    expect(book.chapters[0].html).toContain('src="blob:test-resource"');
    expect(book.cssText).toContain('url("blob:test-resource")');

    releaseInternalEpubResources(book);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-resource");
  });
});
