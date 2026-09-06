import { useMobileChoice } from "./MobileConfirmDialog";
import { extractMobileMetadata } from "./mobileMetadata";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createBookFromFile, inferFileType, readFileAsDataUrl } from "./storage";
import { hashMobileFile } from "./mobileBackup";
import { findDuplicateBook } from "./libraryModel";
import { getStoredBookPatch, writeMobileBookFile } from "./bookFileStorage";
import { acknowledgeNativeBook, getPendingNativeBooks, listenForIncomingBooks, loadNativeBook, pickNativeBooks, supportsNativeDocumentPicker, supportsNativeIncomingBooks, type NativeImportFile } from "./incomingBooksBridge";
import type { MobileBook, MobileTab } from "./types";
import type { useMobileLibrary } from "./useMobileLibrary";
import type { useMobileReaderState } from "./useMobileReaderState";
interface ImportJob {
  id: string;
  name: string;
  progress: number;
  status: "reading" | "processing" | "done" | "cancelled" | "error";
  message?: string;
}

interface ImportCandidate {
  key: string;
  name: string;
  size: number;
  loadFile: (signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<File>;
  acknowledge?: () => Promise<void>;
}

export function useMobileImport({ stateRef, repositoryReady, setState, setReaderDataUrls, setActiveTab, folderId, extractThumbnailPatch }: Pick<ReturnType<typeof useMobileLibrary>, "stateRef" | "repositoryReady" | "setState"> & Pick<ReturnType<typeof useMobileReaderState>, "setReaderDataUrls"> & { setActiveTab: (tab: MobileTab) => void; folderId?: string; extractThumbnailPatch: (book: MobileBook, file: File) => Promise<Partial<MobileBook>> }) {
  const choose = useMobileChoice();
  const libraryQuery = { folderId };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importControllersRef = useRef(new Map<string, AbortController>());
  const incomingProcessingRef = useRef(new Set<string>());
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const updateImportJob = (jobId: string, patch: Partial<ImportJob>) => {
    setImportJobs((current) => current.map((job) => job.id === jobId ? { ...job, ...patch } : job));
  };

  const importCandidates = async (candidates: ImportCandidate[], folderId = libraryQuery.folderId) => {
    if (!candidates.length) return;
    const imported: MobileBook[] = [];
    const existing = [...stateRef.current.books];

    for (const candidate of candidates) {
      const jobId = `import_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const controller = new AbortController();
      importControllersRef.current.set(jobId, controller);
      setImportJobs((current) => [...current.filter((job) => job.status === "reading" || job.status === "processing"), {
        id: jobId,
        name: candidate.name,
        progress: 0,
        status: "reading",
      }]);

      try {
        const file = await candidate.loadFile(controller.signal, (loaded, total) => {
          const progress = total > 0 ? Math.round((loaded / total) * 58) : 12;
          updateImportJob(jobId, { progress: Math.min(58, progress), status: "reading", message: "Lendo arquivo" });
        });
        if (controller.signal.aborted) throw new DOMException("Importacao cancelada", "AbortError");
        if (!inferFileType(file)) throw new Error(`Formato nao suportado: ${file.name}`);
        const contentHash = await hashMobileFile(file);
        const duplicate = [...existing, ...imported].find(book => book.contentHash === contentHash) || findDuplicateBook([...existing, ...imported].filter(book => !book.contentHash), file);
        let duplicateAction: string | null = null;
        if (duplicate) {
          duplicateAction = await choose(
            `“${file.name}” corresponde a “${duplicate.title}”. Substituir atualiza o arquivo e preserva progresso/notas; mesclar preenche metadados vazios.`,
            [
              { value: "skip", label: "Ignorar" },
              { value: "merge", label: "Mesclar" },
              { value: "replace", label: "Substituir" },
            ],
          );
        }
        if (controller.signal.aborted) throw new DOMException("Importação cancelada", "AbortError");
        if (duplicate && duplicateAction !== "replace") {
          if (duplicateAction === "merge") {
            const metadata = await extractMobileMetadata(file, duplicate.fileType).catch(() => ({}));
            const patch = Object.fromEntries(Object.entries(metadata).filter(([key, value]) => value && !duplicate[key as keyof MobileBook]));
            setState(current => ({ ...current, books: current.books.map(b => b.id === duplicate.id ? { ...b, ...patch, contentHash, updatedAt: new Date().toISOString() } : b) }));
          }
          toast(duplicateAction === "merge" ? "Metadados mesclados" : `Ignorado: ${file.name}`);
          updateImportJob(jobId, { progress: 100, status: "done", message: "Ja estava na biblioteca" });
          await candidate.acknowledge?.();
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            const progress = total > 0 ? 58 + Math.round((loaded / total) * 22) : 68;
            updateImportJob(jobId, { progress: Math.min(80, progress), status: "reading", message: "Preparando livro" });
          },
        });
        updateImportJob(jobId, { progress: 84, status: "processing", message: "Extraindo capa e salvando" });
        const book = duplicate && duplicateAction === "replace" ? { ...duplicate, contentHash } : { ...createBookFromFile(file, dataUrl, folderId), contentHash };
        const thumbnailPatch = await extractThumbnailPatch(book, file);
        if (controller.signal.aborted) throw new DOMException("Importacao cancelada", "AbortError");
        const storagePath = await writeMobileBookFile(book, dataUrl, book.folderId);
        const saved = { ...book, ...getStoredBookPatch(book, file, dataUrl, storagePath), ...thumbnailPatch, contentHash };
        if (duplicate) {
          const index = imported.findIndex(b => b.id === duplicate.id);
          if (index >= 0) imported[index] = saved;
          else setState(current => ({ ...current, books: current.books.map(b => b.id === saved.id ? saved : b) }));
        } else imported.push(saved);
        if (storagePath) {
          setReaderDataUrls((current) => ({ ...current, [book.id]: dataUrl }));
        }
        await candidate.acknowledge?.();
        updateImportJob(jobId, { progress: 100, status: "done", message: "Importado" });
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError") || (error instanceof Error && error.message.toLowerCase().includes("cancel"));
        updateImportJob(jobId, {
          status: cancelled ? "cancelled" : "error",
          message: cancelled ? "Cancelado" : error instanceof Error ? error.message : "Falha ao importar arquivo",
        });
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Falha ao importar arquivo");
      } finally {
        importControllersRef.current.delete(jobId);
        incomingProcessingRef.current.delete(candidate.key);
      }
    }

    if (imported.length) {
      setState((current) => ({
        ...current,
        books: [...imported, ...current.books],
        selectedBookId: imported[0].id,
      }));
      toast.success(imported.length === 1 ? "Livro importado" : `${imported.length} livros importados`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importFiles = async (files: FileList | null, folderId = libraryQuery.folderId) => {
    if (!files?.length) return;
    await importCandidates(Array.from(files).map((file) => ({
      key: `web:${file.name}:${file.size}:${file.lastModified}`,
      name: file.name,
      size: file.size,
      loadFile: async () => file,
    })), folderId);
  };

  const importNativeFiles = async (files: NativeImportFile[], folderId = libraryQuery.folderId) => {
    const candidates = files.filter((file) => {
      if (incomingProcessingRef.current.has(file.uri)) return false;
      incomingProcessingRef.current.add(file.uri);
      return true;
    }).map((nativeFile): ImportCandidate => ({
      key: nativeFile.uri,
      name: nativeFile.name,
      size: nativeFile.size,
      loadFile: (signal, onProgress) => loadNativeBook(nativeFile, onProgress, signal),
      acknowledge: () => acknowledgeNativeBook(nativeFile.uri),
    }));
    await importCandidates(candidates, folderId);
  };

  const openFileImporter = async () => {
    if (!supportsNativeDocumentPicker()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      await importNativeFiles(await pickNativeBooks());
    } catch (error) {
      if (!(error instanceof Error && error.message.toLowerCase().includes("cancel"))) {
        toast.error(error instanceof Error ? error.message : "Falha ao abrir o seletor de arquivos");
      }
    }
  };

  useEffect(() => {
    if (!repositoryReady || !supportsNativeIncomingBooks()) return undefined;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    const consumePending = async () => {
      try {
        const pending = await getPendingNativeBooks();
        if (!disposed && pending.length) {
          setActiveTab("library");
          await importNativeFiles(pending);
        }
      } catch (error) {
        if (!disposed) toast.error(error instanceof Error ? error.message : "Falha ao receber arquivo compartilhado");
      }
    };
    void consumePending();
    void listenForIncomingBooks(() => { void consumePending(); }).then((handle) => {
      listener = handle;
    });
    return () => {
      disposed = true;
      void listener?.remove();
    };
  // The native bridge is subscribed once per repository lifecycle. Mutable callbacks read current state through stateRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryReady]);

  return { fileInputRef, importControllersRef, importJobs, setImportJobs, updateImportJob, importFiles, openFileImporter };
}
