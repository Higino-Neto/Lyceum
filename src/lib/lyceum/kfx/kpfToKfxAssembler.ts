import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { LyceumBookMetadata } from "../schema/types";

const execFileAsync = promisify(execFile);

export interface KpfToKfxAssemblyOptions {
  metadata?: Partial<LyceumBookMetadata>;
  kfxlibRoot?: string;
  pythonCommand?: string;
  timeoutMs?: number;
}

export interface KpfToKfxAssemblyResult {
  outputPath: string;
  bytes: number;
  assembler: string;
  kfxlibRoot: string;
  pythonCommand: string;
  stdout: string;
  stderr: string;
  warnings: string[];
}

export type KpfToKfxAssembler = (
  inputKpfPath: string,
  outputKfxPath: string,
  options?: KpfToKfxAssemblyOptions,
) => Promise<KpfToKfxAssemblyResult>;

function hasKfxlib(rootPath: string) {
  return fs.existsSync(path.join(rootPath, "kfxlib", "yj_book.py"));
}

export function findKfxlibRoot(explicitRoot?: string): string | null {
  const candidates = [
    explicitRoot,
    process.env.LYCEUM_KFXLIB_PATH,
    process.env.LYCEUM_KFX_OUTPUT_PLUGIN,
    path.join(process.cwd(), ".tmp", "calibre-kfx-output"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const rootPath = path.resolve(candidate);
    if (hasKfxlib(rootPath)) return rootPath;
  }

  return null;
}

function metadataPayload(metadata?: Partial<LyceumBookMetadata>) {
  const author = metadata?.author?.trim();
  return {
    title: metadata?.title?.trim() || null,
    authors: author ? author.split(/\s*(?:&|;|\band\b)\s*/i).filter(Boolean) : [],
    asin: metadata?.asin?.trim() || metadata?.identifier?.trim() || null,
    cdeType: "EBOK",
    description: metadata?.description?.trim() || null,
    language: metadata?.language?.trim() || null,
    publisher: metadata?.publisher?.trim() || null,
    issueDate: metadata?.publishDate?.trim() || null,
  };
}

async function writeBridgeScript(workspace: string) {
  const scriptPath = path.join(workspace, "assemble-kpf-to-kfx.py");
  const script = String.raw`
import json
import os
import sys
import types
import traceback

payload = json.loads(sys.argv[1])

calibre = types.ModuleType("calibre")
constants = types.ModuleType("calibre.constants")
constants.config_dir = payload["configDir"]
sys.modules.setdefault("calibre", calibre)
sys.modules["calibre.constants"] = constants

sys.path.insert(0, payload["kfxlibRoot"])

from kfxlib import YJ_Book, YJ_Metadata, file_write_binary

def author_sort(value):
    return value

try:
    md = YJ_Metadata(author_sort_fn=author_sort, replace_existing_authors_with_sort=True)
    meta = payload.get("metadata") or {}
    md.title = meta.get("title") or None
    md.authors = meta.get("authors") or []
    md.asin = meta.get("asin") or True
    md.cde_content_type = meta.get("cdeType") or "EBOK"
    md.description = meta.get("description") or None
    md.language = meta.get("language") or None
    md.publisher = meta.get("publisher") or None
    md.issue_date = meta.get("issueDate") or None

    book = YJ_Book(payload["inputPath"])
    book.decode_book(set_metadata=md, set_approximate_pages=payload.get("approximatePages", -1))
    kfx_data = book.convert_to_single_kfx()
    file_write_binary(payload["outputPath"], kfx_data)
    print(json.dumps({"success": True, "bytes": len(kfx_data)}))
except Exception as exc:
    print(json.dumps({"success": False, "error": str(exc), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;
  await fs.promises.writeFile(scriptPath, script, "utf8");
  return scriptPath;
}

async function runBridge(command: string, args: string[], timeoutMs: number) {
  return execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}

function parseBridgeResult(stdout: string): { bytes?: number; error?: string } {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as { success?: boolean; bytes?: number; error?: string };
      if (parsed.success) return { bytes: parsed.bytes };
      return { error: parsed.error || "Falha desconhecida no montador KPF." };
    } catch {
      // kfxlib may log human-readable warnings before the JSON status line.
    }
  }
  return { error: "Montador KPF nao retornou status JSON." };
}

export const assembleKfxFromKpf: KpfToKfxAssembler = async (inputKpfPath, outputKfxPath, options = {}) => {
  const kfxlibRoot = findKfxlibRoot(options.kfxlibRoot);
  if (!kfxlibRoot) {
    throw new Error(
      "Montador KPF -> KFX nao encontrou kfxlib. Defina LYCEUM_KFXLIB_PATH para a raiz do plugin KFX Output ou mantenha .tmp/calibre-kfx-output disponivel.",
    );
  }

  const workspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lyceum-kpf-assembler-"));
  const configDir = path.join(workspace, "kfxlib-config");
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.mkdir(path.dirname(outputKfxPath), { recursive: true });

  const scriptPath = await writeBridgeScript(workspace);
  const payload = {
    inputPath: inputKpfPath,
    outputPath: outputKfxPath,
    kfxlibRoot,
    configDir,
    metadata: metadataPayload(options.metadata),
    approximatePages: -1,
  };

  const commands = options.pythonCommand
    ? [{ command: options.pythonCommand, args: [scriptPath, JSON.stringify(payload)] }]
    : [
        { command: process.env.LYCEUM_PYTHON || "python", args: [scriptPath, JSON.stringify(payload)] },
        { command: "py", args: ["-3", scriptPath, JSON.stringify(payload)] },
      ];

  const failures: string[] = [];
  for (const candidate of commands) {
    try {
      const { stdout, stderr } = await runBridge(candidate.command, candidate.args, options.timeoutMs || 10 * 60 * 1000);
      const parsed = parseBridgeResult(stdout);
      if (parsed.error) throw new Error(parsed.error);
      const bytes = fs.existsSync(outputKfxPath) ? fs.statSync(outputKfxPath).size : parsed.bytes || 0;
      return {
        outputPath: outputKfxPath,
        bytes,
        assembler: "kfxlib-python-bridge",
        kfxlibRoot,
        pythonCommand: candidate.command,
        stdout,
        stderr,
        warnings: [stdout, stderr]
          .join("\n")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("{")),
      };
    } catch (error) {
      failures.push(`${candidate.command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Montagem KPF -> KFX falhou. ${failures.join(" | ")}`);
};
