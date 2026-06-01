import fs from "node:fs";
import type {
  LyceumBookMetadata,
  LyceumComicContent,
  LyceumComicPage,
  LyceumManifest,
  LyceumPackage,
  LyceumTextualChapter,
  LyceumTextualContent,
  LyceumTextualResource,
} from "../schema/types";
import {
  comicPagesPath,
  manifestPath,
  metadataPath,
  textualChapterPath,
  textualFulltextPath,
  textualResourcesPath,
  textualSpinePath,
  textualTocPath,
} from "./paths";

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON invalido em ${filePath}: ${detail}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} invalido: objeto JSON esperado.`);
  }

  return value;
}

function requireString(value: Record<string, unknown>, key: string, label: string) {
  if (typeof value[key] !== "string" || !String(value[key]).trim()) {
    throw new Error(`${label} invalido: campo "${key}" ausente ou invalido.`);
  }

  return String(value[key]);
}

function optionalString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? String(value[key]) : undefined;
}

function validateManifest(value: unknown): LyceumManifest {
  const manifest = assertRecord(value, "manifest.json");
  if (manifest.schemaVersion !== 1) {
    throw new Error("manifest.json invalido: schemaVersion precisa ser 1.");
  }

  return {
    schemaVersion: 1,
    packageId: requireString(manifest, "packageId", "manifest.json"),
    title: requireString(manifest, "title", "manifest.json"),
    sourceFormat: requireString(manifest, "sourceFormat", "manifest.json") as LyceumManifest["sourceFormat"],
    originalFileName: requireString(manifest, "originalFileName", "manifest.json"),
    primaryContentKind: requireString(manifest, "primaryContentKind", "manifest.json") as LyceumManifest["primaryContentKind"],
    contentKinds: Array.isArray(manifest.contentKinds)
      ? manifest.contentKinds.filter((item): item is LyceumManifest["contentKinds"][number] => typeof item === "string")
      : [],
    createdAt: requireString(manifest, "createdAt", "manifest.json"),
    updatedAt: requireString(manifest, "updatedAt", "manifest.json"),
  };
}

function validateMetadata(value: unknown): LyceumBookMetadata {
  const metadata = assertRecord(value, "metadata/book.json");

  return {
    title: requireString(metadata, "title", "metadata/book.json"),
    author: optionalString(metadata, "author"),
    language: optionalString(metadata, "language"),
    identifier: optionalString(metadata, "identifier"),
    publisher: optionalString(metadata, "publisher"),
    description: optionalString(metadata, "description"),
    publishDate: optionalString(metadata, "publishDate"),
  };
}

function validateSpine(value: unknown): LyceumTextualContent["spine"] {
  if (!Array.isArray(value)) {
    throw new Error("content/textual/spine.json invalido: array esperado.");
  }

  return value.map((item, index) => {
    const spineItem = assertRecord(item, `spine item ${index + 1}`);
    return {
      id: requireString(spineItem, "id", `spine item ${index + 1}`),
      href: requireString(spineItem, "href", `spine item ${index + 1}`),
      title: requireString(spineItem, "title", `spine item ${index + 1}`),
    };
  });
}

function validateToc(value: unknown): LyceumTextualContent["toc"] {
  if (!Array.isArray(value)) {
    throw new Error("content/textual/toc.json invalido: array esperado.");
  }

  return value.map((item, index) => {
    const tocItem = assertRecord(item, `toc item ${index + 1}`);
    return {
      id: requireString(tocItem, "id", `toc item ${index + 1}`),
      href: requireString(tocItem, "href", `toc item ${index + 1}`),
      title: requireString(tocItem, "title", `toc item ${index + 1}`),
      level: typeof tocItem.level === "number" && Number.isFinite(tocItem.level)
        ? tocItem.level
        : 1,
    };
  });
}

function validateResources(value: unknown): LyceumTextualResource[] {
  if (!Array.isArray(value)) {
    throw new Error("content/textual/resources.json invalido: array esperado.");
  }

  return value.map((item, index) => {
    const resource = assertRecord(item, `resource item ${index + 1}`);
    return {
      id: requireString(resource, "id", `resource item ${index + 1}`),
      href: requireString(resource, "href", `resource item ${index + 1}`),
      mediaType: requireString(resource, "mediaType", `resource item ${index + 1}`),
      properties: optionalString(resource, "properties"),
    };
  });
}

function validateComicPage(value: unknown, index: number): LyceumComicPage {
  const page = assertRecord(value, `comic page ${index + 1}`);
  const byteLength = page.byteLength;

  return {
    id: requireString(page, "id", `comic page ${index + 1}`),
    href: requireString(page, "href", `comic page ${index + 1}`),
    title: requireString(page, "title", `comic page ${index + 1}`),
    mediaType: requireString(page, "mediaType", `comic page ${index + 1}`),
    byteLength: typeof byteLength === "number" && Number.isFinite(byteLength) ? byteLength : 0,
    width: typeof page.width === "number" && Number.isFinite(page.width) ? page.width : undefined,
    height: typeof page.height === "number" && Number.isFinite(page.height) ? page.height : undefined,
    resourceHref: optionalString(page, "resourceHref"),
    originalPath: optionalString(page, "originalPath"),
  };
}

function validateComicContent(value: unknown): LyceumComicContent {
  const comic = assertRecord(value, "content/comic/pages.json");
  const pages = Array.isArray(comic.pages)
    ? comic.pages.map(validateComicPage)
    : [];
  const pageCount = typeof comic.pageCount === "number" && Number.isFinite(comic.pageCount)
    ? comic.pageCount
    : pages.length;
  const totalBytes = typeof comic.totalBytes === "number" && Number.isFinite(comic.totalBytes)
    ? comic.totalBytes
    : pages.reduce((sum, page) => sum + page.byteLength, 0);

  return { pages, pageCount, totalBytes };
}

function readTextualContent(rootPath: string): LyceumTextualContent | undefined {
  const spinePath = textualSpinePath(rootPath);
  if (!fs.existsSync(spinePath)) {
    return undefined;
  }

  const spine = validateSpine(readJson<unknown>(spinePath));
  const toc = fs.existsSync(textualTocPath(rootPath))
    ? validateToc(readJson<unknown>(textualTocPath(rootPath)))
    : [];
  const resources = fs.existsSync(textualResourcesPath(rootPath))
    ? validateResources(readJson<unknown>(textualResourcesPath(rootPath)))
    : [];
  const fulltext = fs.existsSync(textualFulltextPath(rootPath))
    ? fs.readFileSync(textualFulltextPath(rootPath), "utf8")
    : "";

  const chapters = spine.map<LyceumTextualChapter>((item) => ({
    id: item.id,
    href: item.href,
    title: item.title,
    xhtml: fs.readFileSync(textualChapterPath(rootPath, item.href), "utf8"),
  }));

  return {
    chapters,
    spine,
    toc,
    fulltext,
    resources,
  };
}

function readComicContent(rootPath: string): LyceumComicContent | undefined {
  const pagesPath = comicPagesPath(rootPath);
  if (!fs.existsSync(pagesPath)) {
    return undefined;
  }

  return validateComicContent(readJson<unknown>(pagesPath));
}

export function readLyceumPackage(rootPath: string): LyceumPackage {
  const manifest = validateManifest(readJson<unknown>(manifestPath(rootPath)));
  const metadata = validateMetadata(readJson<unknown>(metadataPath(rootPath)));

  return {
    rootPath,
    manifest,
    metadata,
    textual: readTextualContent(rootPath),
    comic: readComicContent(rootPath),
  };
}
