import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { convertViaLyceum, readLyceumPackage } from "../lib/lyceum";

async function writeEpub(zip: JSZip, filePath: string) {
  fs.writeFileSync(filePath, Buffer.from(await zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" })));
}

function tempPaths(name: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `lyceum-${name}-`));
  return {
    tempDir,
    sourcePath: path.join(tempDir, `${name}.epub`),
    packageRoot: path.join(tempDir, `${name}.lyceum`),
    outputPath: path.join(tempDir, `${name}.txt`),
  };
}

async function importEpub(zip: JSZip, name: string) {
  const paths = tempPaths(name);
  await writeEpub(zip, paths.sourcePath);
  const result = await convertViaLyceum({
    sourcePath: paths.sourcePath,
    sourceFormat: "epub",
    targetFormat: "txt",
    packageRoot: paths.packageRoot,
    outputPath: paths.outputPath,
  });
  return {
    ...paths,
    result,
    pkg: readLyceumPackage(paths.packageRoot),
  };
}

function addContainer(zip: JSZip, opfPath = "OPS/package.opf") {
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`,
  );
}

describe("EPUB parser phase 0", () => {
  it("imports OPF with alternate namespace prefixes, encoded hrefs and parent paths", async () => {
    const zip = new JSZip();
    addContainer(zip);
    zip.file(
      "OPS/package.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
      <opf:package xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dcx="http://purl.org/dc/elements/1.1/" unique-identifier="uid">
        <opf:metadata>
          <dcx:identifier id="uid">urn:uuid:phase0-alt-prefix</dcx:identifier>
          <dcx:title>Namespace Alternativo</dcx:title>
          <dcx:creator>Autora Prefixada</dcx:creator>
          <dcx:language>pt-BR</dcx:language>
        </opf:metadata>
        <opf:manifest>
          <opf:item id="chap1" href="../Text/Cap%201.xhtml" media-type="application/xhtml+xml"/>
          <opf:item id="img1" href="../Images/pic%201.png" media-type="image/png"/>
        </opf:manifest>
        <opf:spine>
          <opf:itemref idref="chap1"/>
        </opf:spine>
      </opf:package>`,
    );
    zip.file("Text/Cap 1.xhtml", `<html><body><h1>Inicio</h1><p>Texto com imagem.</p><img src="../Images/pic%201.png"/></body></html>`);
    zip.file("Images/pic 1.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const { pkg } = await importEpub(zip, "phase0-alt");

    expect(pkg.metadata.title).toBe("Namespace Alternativo");
    expect(pkg.metadata.author).toBe("Autora Prefixada");
    expect(pkg.textual?.chapters).toHaveLength(1);
    expect(pkg.textual?.resources?.[0].href).toBe("Images/pic 1.png");
  });

  it("keeps linear=no spine items as extra resources outside the main flow", async () => {
    const zip = new JSZip();
    addContainer(zip);
    zip.file(
      "OPS/package.opf",
      `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Linear No</dc:title>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="main" href="main.xhtml" media-type="application/xhtml+xml"/>
          <item id="extra" href="appendix.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="main"/>
          <itemref idref="extra" linear="no"/>
        </spine>
      </package>`,
    );
    zip.file("OPS/main.xhtml", "<html><body><h1>Main</h1><p>Fluxo principal.</p></body></html>");
    zip.file("OPS/appendix.xhtml", "<html><body><h1>Extra</h1><p>Fora do fluxo.</p></body></html>");

    const { pkg } = await importEpub(zip, "phase0-linear");

    expect(pkg.textual?.chapters.map((chapter) => chapter.title)).toEqual(["Main"]);
    const extra = pkg.textual?.resources?.find((resource) => resource.id === "extra");
    expect(extra?.properties?.split(/\s+/)).toEqual(expect.arrayContaining(["extra", "linear-no"]));
  });

  it("resolves manifest fallback chains or emits actionable warnings", async () => {
    const zip = new JSZip();
    addContainer(zip);
    zip.file(
      "OPS/package.opf",
      `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Fallback Chain</dc:title>
          <dc:language>pt-BR</dc:language>
        </metadata>
        <manifest>
          <item id="chap" href="text/ch.xhtml" media-type="application/xhtml+xml"/>
          <item id="webp" href="img/missing.webp" media-type="image/webp" fallback="png"/>
          <item id="png" href="img/page.png" media-type="image/png"/>
        </manifest>
        <spine><itemref idref="chap"/></spine>
      </package>`,
    );
    zip.file("OPS/text/ch.xhtml", `<html><body><h1>Capitulo</h1><img src="../img/missing.webp"/></body></html>`);
    zip.file("OPS/img/page.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const { pkg, result } = await importEpub(zip, "phase0-fallback");
    const fallback = pkg.textual?.resources?.find((resource) => resource.id === "webp");

    expect(fallback?.mediaType).toBe("image/png");
    expect(fallback?.properties?.split(/\s+/)).toContain("has-fallback");
    expect(result.importReport.warnings.join("\n")).toMatch(/fallback/i);
  });

  it("preserves OPF 3 refinements and Calibre metadata in canonical metadata", async () => {
    const zip = new JSZip();
    addContainer(zip);
    zip.file(
      "OPS/package.opf",
      `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:identifier id="uid">urn:uuid:phase0-refinements</dc:identifier>
          <dc:title id="title">O Livro</dc:title>
          <meta refines="#title" property="file-as">Livro, O</meta>
          <meta refines="#title" property="display-seq">1</meta>
          <dc:creator id="creator">Maria Teste</dc:creator>
          <meta refines="#creator" property="file-as">Teste, Maria</meta>
          <meta refines="#creator" property="role">aut</meta>
          <dc:language>pt-BR</dc:language>
          <dc:subject>Assunto A</dc:subject>
          <dc:subject>Assunto B</dc:subject>
          <dc:rights>Direitos reservados</dc:rights>
          <dc:contributor>Editor Teste</dc:contributor>
          <meta name="calibre:series" content="Serie Lyceum"/>
          <meta name="calibre:series_index" content="3"/>
          <meta name="calibre:rating" content="4"/>
          <meta name="calibre:timestamp" content="2024-01-02T03:04:05+00:00"/>
        </metadata>
        <manifest>
          <item id="chap" href="ch.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="chap"/></spine>
      </package>`,
    );
    zip.file("OPS/ch.xhtml", "<html><body><h1>Inicio</h1><p>Texto.</p></body></html>");

    const { pkg } = await importEpub(zip, "phase0-refinements");

    expect(pkg.metadata.identifier).toBe("urn:uuid:phase0-refinements");
    expect(pkg.metadata.titleSort).toBe("Livro, O");
    expect(pkg.metadata.authorSort).toBe("Teste, Maria");
    expect(pkg.metadata.displaySeq).toBe("1");
    expect(pkg.metadata.series).toBe("Serie Lyceum");
    expect(pkg.metadata.seriesIndex).toBe("3");
    expect(pkg.metadata.rating).toBe(4);
    expect(pkg.metadata.timestamp).toBe("2024-01-02T03:04:05+00:00");
    expect(pkg.metadata.subject).toBe("Assunto A; Assunto B");
    expect(pkg.metadata.rights).toBe("Direitos reservados");
    expect(pkg.metadata.contributor).toBe("Editor Teste");
  });
});
