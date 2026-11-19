import fs from "node:fs";
import path from "node:path";
import type { IpcMain } from "electron";
import type {
  PdfToolRequest,
  PdfToolResponse,
  ToolFileKind,
  ToolPickedFile,
  ToolRunRequest,
} from "../services/pdf-tools-types";
import { PDF_TOOL_IMAGE_EXTENSIONS, renderImageThumbnail } from "../services/pdf-tools";

export interface PdfToolsHandlerDependencies {
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;
  showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue>;
  runPdfTool(request: PdfToolRequest, onProgress?: (progress: number, message?: string) => void): Promise<PdfToolResponse>;
  sendProgress(payload: { jobId: string; progress: number; message?: string }): void;
  showInFolder(filePath: string): void;
}

const BOOK_EXTENSIONS = ["pdf", "epub", "cbz", "azw3", "kfx", "txt", "html", "htm", "mobi"];

const FILTERS: Record<ToolFileKind, Electron.FileFilter[]> = {
  images: [{ name: "Imagens", extensions: PDF_TOOL_IMAGE_EXTENSIONS }],
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
  books: [{ name: "Livros", extensions: BOOK_EXTENSIONS }],
  builder: [
    { name: "PDF e imagens", extensions: ["pdf", ...PDF_TOOL_IMAGE_EXTENSIONS] },
    { name: "PDF", extensions: ["pdf"] },
    { name: "Imagens", extensions: PDF_TOOL_IMAGE_EXTENSIONS },
  ],
};

const SAVE_FILTERS: Record<"pdf" | "cbz", Electron.FileFilter[]> = {
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
  cbz: [{ name: "CBZ", extensions: ["cbz"] }],
};

function describeFile(filePath: string): ToolPickedFile | null {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return null;
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).slice(1).toLowerCase(),
      size: stats.size,
    };
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Natural sort so "page2.jpg" comes before "page10.jpg" — how scans are usually named. */
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function registerPdfToolsHandlers(ipcMain: IpcMain, dependencies: PdfToolsHandlerDependencies): void {
  // Outputs may only be written to paths the user confirmed in a save dialog.
  const approvedOutputs = new Set<string>();

  ipcMain.handle("tools:pick-files", async (_, kind: ToolFileKind) => {
    const filters = FILTERS[kind];
    if (!filters) return [];
    const result = await dependencies.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters,
    });
    if (result.canceled) return [];
    return result.filePaths
      .slice()
      .sort((a, b) => naturalCollator.compare(path.basename(a), path.basename(b)))
      .map(describeFile)
      .filter((file): file is ToolPickedFile => Boolean(file));
  });

  ipcMain.handle("tools:describe-files", (_, filePaths: string[]) =>
    (Array.isArray(filePaths) ? filePaths : [])
      .filter((filePath) => typeof filePath === "string")
      .map(describeFile)
      .filter((file): file is ToolPickedFile => Boolean(file)));

  ipcMain.handle("tools:pick-save-path", async (_, format: "pdf" | "cbz", suggestedName?: string, nearPath?: string) => {
    const extension = format === "cbz" ? "cbz" : "pdf";
    const baseName = (suggestedName || "documento").replace(/[\\/:*?"<>|]+/g, " ").trim() || "documento";
    const fileName = baseName.toLowerCase().endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
    const result = await dependencies.showSaveDialog({
      defaultPath: nearPath ? path.join(path.dirname(nearPath), fileName) : fileName,
      filters: SAVE_FILTERS[extension],
    });
    if (result.canceled || !result.filePath) return null;
    const outputPath = path.extname(result.filePath) ? result.filePath : `${result.filePath}.${extension}`;
    approvedOutputs.add(path.resolve(outputPath));
    return outputPath;
  });

  ipcMain.handle("tools:image-thumbnail", async (_, imagePath: string) => {
    try {
      return { success: true, ...(await renderImageThumbnail(imagePath)) };
    } catch (error) {
      return { success: false, error: errorMessage(error, "Imagem invalida") };
    }
  });

  ipcMain.handle("tools:pdf-info", async (_, filePath: string) => {
    try {
      const response = await dependencies.runPdfTool({ operation: "info", input: { filePath } });
      return response.operation === "info" ? { success: true, ...response.info } : { success: false, error: "Resposta invalida" };
    } catch (error) {
      return { success: false, error: errorMessage(error, "Nao foi possivel abrir o PDF") };
    }
  });

  ipcMain.handle("tools:pdf-thumbnails", async (_, filePath: string, pages: number[]) => {
    try {
      const safePages = (Array.isArray(pages) ? pages : []).filter((page) => Number.isInteger(page) && page > 0).slice(0, 48);
      const response = await dependencies.runPdfTool({ operation: "thumbnails", input: { filePath, pages: safePages, maxDimension: 420 } });
      return response.operation === "thumbnails" ? { success: true, thumbnails: response.thumbnails } : { success: false, thumbnails: [] };
    } catch (error) {
      return { success: false, thumbnails: [], error: errorMessage(error, "Falha ao gerar miniaturas") };
    }
  });

  ipcMain.handle("tools:analyze-exercises", async (_, filePath: string, jobId?: string) => {
    if (typeof filePath !== "string" || !filePath.toLowerCase().endsWith(".pdf") || !fs.existsSync(filePath)) {
      return { success: false, error: "PDF nao encontrado" };
    }
    try {
      const response = await dependencies.runPdfTool({ operation: "analyze-exercises", input: { filePath } }, jobId
        ? (progress, message) => dependencies.sendProgress({ jobId, progress, message })
        : undefined);
      return response.operation === "exercises" ? { success: true, analysis: response.analysis } : { success: false, error: "Resposta invalida" };
    } catch (error) {
      return { success: false, error: errorMessage(error, "Nao foi possivel analisar o PDF") };
    }
  });

  ipcMain.handle("tools:run", async (_, request: ToolRunRequest, jobId?: string) => {
    const outputPath = request?.input?.outputPath;
    if (!outputPath || !approvedOutputs.has(path.resolve(outputPath))) {
      return { success: false, error: "Escolha onde salvar o arquivo antes de continuar." };
    }
    if (!["build-pdf", "images-to-cbz"].includes(request.operation)) {
      return { success: false, error: "Operacao desconhecida" };
    }
    try {
      const response = await dependencies.runPdfTool(request, jobId
        ? (progress, message) => dependencies.sendProgress({ jobId, progress, message })
        : undefined);
      if (response.operation !== "result") return { success: false, error: "Resposta invalida" };
      return { success: true, ...response.result };
    } catch (error) {
      return { success: false, error: errorMessage(error, "Falha ao processar os arquivos") };
    }
  });

  ipcMain.handle("tools:show-in-folder", (_, filePath: string) => {
    if (typeof filePath === "string" && approvedOutputs.has(path.resolve(filePath)) && fs.existsSync(filePath)) {
      dependencies.showInFolder(filePath);
      return true;
    }
    return false;
  });
}
