import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import type { ImportInput, ImportResult, LyceumImporter } from "../schema/types";
import { CbzImporter } from "./cbzImporter";
import { LyceumImportError } from "./importErrors";

const execFileAsync = promisify(execFile);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const EXTRACT_TIMEOUT_MS = 120_000;

/**
 * CBR (RAR comic archive). RAR decompression is proprietary, so extraction
 * uses whatever tool the system already has; many ".cbr" files are actually
 * ZIPs and go straight to the CBZ importer.
 */

interface Extractor {
  command: string;
  args: (archive: string, output: string) => string[];
}

function extractorCandidates(): Extractor[] {
  const sevenZip = (command: string): Extractor => ({ command, args: (archive, output) => ["x", "-y", `-o${output}`, archive] });
  const candidates: Extractor[] = [
    sevenZip("7z"),
    sevenZip("7zz"),
    { command: "unrar", args: (archive, output) => ["x", "-o+", "-y", archive, `${output}${path.sep}`] },
    { command: "unar", args: (archive, output) => ["-q", "-f", "-o", output, archive] },
    { command: "bsdtar", args: (archive, output) => ["-xf", archive, "-C", output] },
  ];
  if (process.platform === "win32") {
    const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean) as string[];
    for (const root of programFiles) {
      candidates.unshift(sevenZip(path.join(root, "7-Zip", "7z.exe")));
      candidates.push({ command: path.join(root, "WinRAR", "UnRAR.exe"), args: (archive, output) => ["x", "-o+", "-y", archive, `${output}${path.sep}`] });
    }
    // Windows 10+ ships libarchive's tar, which reads RAR.
    candidates.push({ command: "tar", args: (archive, output) => ["-xf", archive, "-C", output] });
  } else if (process.platform === "darwin") {
    candidates.push({ command: "/opt/homebrew/bin/7zz", args: (archive, output) => ["x", "-y", `-o${output}`, archive] });
  }
  return candidates;
}

function listImages(directory: string): string[] {
  const results: string[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) results.push(fullPath);
    }
  };
  visit(directory);
  return results;
}

async function extractRar(archive: string, output: string): Promise<boolean> {
  for (const extractor of extractorCandidates()) {
    try {
      await execFileAsync(extractor.command, extractor.args(archive, output), {
        timeout: EXTRACT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (listImages(output).length > 0) return true;
    } catch {
      // Not installed or cannot read this archive: try the next tool.
    }
  }
  return false;
}

async function zipImages(directory: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const image of listImages(directory)) {
    const relative = path.relative(directory, image).split(path.sep).join("/");
    zip.file(relative, await fs.promises.readFile(image), { compression: "STORE" });
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

export class CbrImporter implements LyceumImporter {
  inputFormat = "cbr" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const cbz = new CbzImporter();
    const header = Buffer.alloc(4);
    const handle = await fs.promises.open(input.sourcePath, "r");
    try {
      await handle.read(header, 0, 4, 0);
    } finally {
      await handle.close();
    }
    if (header[0] === 0x50 && header[1] === 0x4b) {
      const result = await cbz.import(input);
      result.report.sourceFormat = "cbr";
      return result;
    }

    const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-cbr-"));
    try {
      const extracted = path.join(workDir, "pages");
      await fs.promises.mkdir(extracted);
      input.onProgress?.(0.05, "Extraindo arquivo RAR");
      if (!await extractRar(input.sourcePath, extracted)) {
        throw new LyceumImportError(
          "rar-extractor-missing",
          "Nenhum extrator RAR disponivel (instale 7-Zip, unrar ou unar).",
        );
      }
      const zipped = path.join(workDir, `${path.basename(input.sourcePath, path.extname(input.sourcePath))}.cbz`);
      await fs.promises.writeFile(zipped, await zipImages(extracted));
      const result = await cbz.import({ ...input, sourcePath: zipped });
      result.report.sourceFormat = "cbr";
      result.package.manifest.sourceFormat = "cbr";
      result.package.manifest.originalFileName = path.basename(input.sourcePath);
      return result;
    } finally {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    }
  }
}
