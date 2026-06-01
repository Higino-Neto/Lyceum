import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";

const execFileAsync = promisify(execFile);

export type KindlePreviewerOutputFormat = "kfx" | "kpf" | "mobi";

export interface KindlePreviewerGeneratedFile {
  path: string;
  format: KindlePreviewerOutputFormat;
  size: number;
}

export interface KindlePreviewerConversionOptions {
  inputPath: string;
  outputDir: string;
  executablePath?: string;
  timeoutMs?: number;
}

export interface KindlePreviewerConversionResult {
  executablePath: string;
  generatedFiles: KindlePreviewerGeneratedFile[];
  primaryOutputPath?: string;
  primaryOutputFormat?: KindlePreviewerOutputFormat;
  stdout: string;
  stderr: string;
  logs: string[];
}

export interface KpfArchiveInspection {
  entryCount: number;
  entries: string[];
  isZip: boolean;
  isEpubZip: boolean;
  likelyKpf: boolean;
  metadataEntries: string[];
}

function candidatePreviewerPaths() {
  const candidates = [
    process.env.LYCEUM_KINDLE_PREVIEWER,
    process.env.KINDLE_PREVIEWER,
  ].filter(Boolean) as string[];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const windowsCandidates = [
      localAppData && path.join(localAppData, "Amazon", "Kindle Previewer 3", "Kindle Previewer 3.exe"),
      localAppData && path.join(localAppData, "Amazon", "Kindle Previewer 3", "kindlepreviewer.exe"),
      programFiles && path.join(programFiles, "Amazon", "Kindle Previewer 3", "Kindle Previewer 3.exe"),
      programFiles && path.join(programFiles, "Amazon", "Kindle Previewer 3", "kindlepreviewer.exe"),
      programFilesX86 && path.join(programFilesX86, "Amazon", "Kindle Previewer 3", "Kindle Previewer 3.exe"),
      programFilesX86 && path.join(programFilesX86, "Amazon", "Kindle Previewer 3", "kindlepreviewer.exe"),
      "kindlepreviewer.exe",
      "kindlepreviewer",
    ].filter(Boolean) as string[];
    candidates.push(...windowsCandidates);
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Kindle Previewer 3.app/Contents/MacOS/Kindle Previewer 3",
      "kindlepreviewer",
    );
  } else {
    candidates.push("kindlepreviewer");
  }

  return Array.from(new Set(candidates));
}

export function findKindlePreviewerExecutable() {
  for (const candidate of candidatePreviewerPaths()) {
    if (!candidate) continue;
    if (candidate.includes(path.sep) || path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }

  return null;
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else {
        results.push(entryPath);
      }
    }
  }

  return results;
}

function outputFormatForPath(filePath: string): KindlePreviewerOutputFormat | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".kfx") return "kfx";
  if (extension === ".kpf") return "kpf";
  if (extension === ".mobi") return "mobi";
  return null;
}

function readPreviewerLogs(outputDir: string) {
  return walkFiles(outputDir)
    .filter((filePath) => /\.(log|txt)$/i.test(filePath))
    .slice(0, 8)
    .map((filePath) => {
      try {
        return fs.readFileSync(filePath, "utf8").slice(0, 12000);
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function collectGeneratedFiles(outputDir: string): KindlePreviewerGeneratedFile[] {
  return walkFiles(outputDir)
    .map((filePath) => {
      const format = outputFormatForPath(filePath);
      if (!format) return null;
      return {
        path: filePath,
        format,
        size: fs.statSync(filePath).size,
      };
    })
    .filter((item): item is KindlePreviewerGeneratedFile => Boolean(item))
    .sort((a, b) => {
      const priority = (format: KindlePreviewerOutputFormat) =>
        format === "kfx" ? 0 : format === "kpf" ? 1 : 2;
      return priority(a.format) - priority(b.format) || b.size - a.size;
    });
}

export async function runKindlePreviewerConversion(
  options: KindlePreviewerConversionOptions,
): Promise<KindlePreviewerConversionResult> {
  const executablePath = options.executablePath || findKindlePreviewerExecutable();
  if (!executablePath) {
    throw new Error(
      "Kindle Previewer nao encontrado. Instale o Kindle Previewer 3 ou defina LYCEUM_KINDLE_PREVIEWER com o caminho do executavel.",
    );
  }

  await fs.promises.mkdir(options.outputDir, { recursive: true });

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(
      executablePath,
      [options.inputPath, "-convert", "-output", options.outputDir],
      {
        timeout: options.timeoutMs ?? 10 * 60 * 1000,
        maxBuffer: 12 * 1024 * 1024,
        windowsHide: true,
      },
    );
    stdout = result.stdout || "";
    stderr = result.stderr || "";
  } catch (error) {
    const detail = error as Error & { stdout?: string; stderr?: string };
    stdout = detail.stdout || "";
    stderr = detail.stderr || "";
    const logs = readPreviewerLogs(options.outputDir);
    throw new Error(
      [
        "Kindle Previewer falhou ao converter o livro.",
        detail.message,
        stderr.trim(),
        stdout.trim(),
        ...logs,
      ].filter(Boolean).join("\n"),
    );
  }

  const generatedFiles = collectGeneratedFiles(options.outputDir);
  const primary = generatedFiles[0];

  return {
    executablePath,
    generatedFiles,
    primaryOutputPath: primary?.path,
    primaryOutputFormat: primary?.format,
    stdout,
    stderr,
    logs: readPreviewerLogs(options.outputDir),
  };
}

export async function inspectKpfArchive(filePath: string): Promise<KpfArchiveInspection> {
  const buffer = await fs.promises.readFile(filePath);
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return {
      entryCount: 0,
      entries: [],
      isZip: false,
      isEpubZip: false,
      likelyKpf: false,
      metadataEntries: [],
    };
  }

  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files).sort();
  const mimetype = await zip.file("mimetype")?.async("text");
  const isEpubZip = mimetype?.trim() === "application/epub+zip";
  const metadataEntries = entries.filter((entry) =>
    /(^|\/)(metadata|book|content|manifest|package)\.(json|xml|opf|kdf|db|sqlite)$/i.test(entry),
  );

  return {
    entryCount: entries.length,
    entries,
    isZip: true,
    isEpubZip,
    likelyKpf: !isEpubZip && entries.length > 0,
    metadataEntries,
  };
}

export async function createPreviewerWorkspace(prefix = "lyceum-kfx") {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}
