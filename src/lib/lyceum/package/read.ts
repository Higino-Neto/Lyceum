import fs from "node:fs";
import path from "node:path";
import type {
  LyceumBookMetadata,
  LyceumManifest,
  LyceumPackage,
  LyceumTextualChapter,
  LyceumTextualContent,
} from "../schema/types";
import {
  manifestPath,
  metadataPath,
  textualFulltextPath,
  textualSpinePath,
  textualTocPath,
} from "./paths";

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readTextualContent(rootPath: string): LyceumTextualContent | undefined {
  const spinePath = textualSpinePath(rootPath);
  if (!fs.existsSync(spinePath)) {
    return undefined;
  }

  const spine = readJson<LyceumTextualContent["spine"]>(spinePath);
  const toc = fs.existsSync(textualTocPath(rootPath))
    ? readJson<LyceumTextualContent["toc"]>(textualTocPath(rootPath))
    : [];
  const fulltext = fs.existsSync(textualFulltextPath(rootPath))
    ? fs.readFileSync(textualFulltextPath(rootPath), "utf8")
    : "";

  const chapters = spine.map<LyceumTextualChapter>((item) => ({
    id: item.id,
    href: item.href,
    title: item.title,
    xhtml: fs.readFileSync(
      path.join(rootPath, "content", "textual", "chapters", path.basename(item.href)),
      "utf8",
    ),
  }));

  return {
    chapters,
    spine,
    toc,
    fulltext,
  };
}

export function readLyceumPackage(rootPath: string): LyceumPackage {
  const manifest = readJson<LyceumManifest>(manifestPath(rootPath));
  const metadata = readJson<LyceumBookMetadata>(metadataPath(rootPath));

  return {
    rootPath,
    manifest,
    metadata,
    textual: readTextualContent(rootPath),
  };
}

