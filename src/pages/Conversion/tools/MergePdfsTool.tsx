import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePlus, Files, Library, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/useTranslation";
import { LibraryPickerDialog } from "../../../components/library/LibraryPickerDialog";
import { fetchAtlasBooks } from "../../Atlas/atlasUtils";
import { formatFileSize, getTitleWithoutExtension } from "../../Library/utils";
import {
  SortableFileList,
  TextField,
  ToolButton,
  ToolPanel,
  ToolRunStatus,
} from "./ToolShared";
import { createToolFileId, stripExtension, toToolFiles, useToolRunner, type ToolFile } from "./toolUtils";

interface PdfInfoState {
  pageCount?: number;
  error?: string;
}

export default function MergePdfsTool() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [info, setInfo] = useState<Record<string, PdfInfoState>>({});
  const [title, setTitle] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { state, run, reset } = useToolRunner();
  const running = state.status === "running";

  const booksQuery = useQuery({
    queryKey: ["conversion-library-books"],
    queryFn: fetchAtlasBooks,
    enabled: pickerOpen,
    staleTime: 20_000,
  });
  const libraryPdfs = useMemo(() => {
    const chosen = new Set(files.map((file) => file.path));
    return (booksQuery.data ?? []).filter((book) =>
      (book.fileType || "").toLowerCase() === "pdf" && !book.fileHash.includes(":") && !chosen.has(book.filePath));
  }, [booksQuery.data, files]);

  // Page counts are read in the worker as files are added; each path is requested once.
  const requestedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    for (const filePath of new Set(files.map((file) => file.path))) {
      if (requestedRef.current.has(filePath)) continue;
      requestedRef.current.add(filePath);
      void window.api.getToolPdfInfo(filePath).then((result) => {
        if (!mountedRef.current) return;
        setInfo((current) => ({
          ...current,
          [filePath]: result.success ? { pageCount: result.pageCount } : { error: result.error },
        }));
      });
    }
  }, [files]);

  const addFiles = (next: ToolFile[]) => {
    if (next.length === 0) return;
    reset();
    setFiles((current) => [...current, ...next]);
    if (!title) setTitle(stripExtension(next[0].name));
  };

  const totalPages = files.reduce((sum, file) => sum + (info[file.path]?.pageCount || 0), 0);
  const hasUnreadable = files.some((file) => info[file.path]?.error);

  const handleRun = async () => {
    const outputPath = await window.api.pickToolSavePath("pdf", title || stripExtension(files[0]?.name || "mesclado"), files[0]?.path);
    if (!outputPath) return;
    await run({ operation: "merge-pdfs", input: { inputPaths: files.map((file) => file.path), outputPath, title } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
      <main className="flex-none lg:min-h-0 lg:overflow-y-auto">
        <ToolPanel
          title={t("conversion:tools.merge.title")}
          description={t("conversion:tools.merge.description")}
          actions={
            <>
              <ToolButton onClick={() => setFiles([])} disabled={files.length === 0 || running}>
                <Trash2 size={14} />
                {t("conversion:tools.common.clear")}
              </ToolButton>
              <ToolButton onClick={() => setPickerOpen(true)} disabled={running}>
                <Library size={14} />
                {t("conversion:tools.common.addFromLibrary")}
              </ToolButton>
              <ToolButton onClick={() => void window.api.pickToolFiles("pdf").then((picked) => addFiles(toToolFiles(picked, "pdf")))} disabled={running}>
                <FilePlus size={14} />
                {t("conversion:tools.common.addFromComputer")}
              </ToolButton>
            </>
          }
        >
          {files.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-foreground-subtle">
              <Files size={24} />
              {t("conversion:tools.merge.empty")}
            </div>
          ) : (
            <>
              <p className="border-b border-border px-4 py-2 text-xs text-foreground-subtle">
                {t("conversion:tools.common.files", { count: files.length })} · {t("conversion:tools.merge.totalPages", { count: totalPages })} · {t("conversion:tools.common.dropHint")}
              </p>
              <SortableFileList
                items={files}
                onChange={(next) => { reset(); setFiles(next); }}
                renderMeta={(file) => {
                  const fileInfo = info[file.path];
                  if (fileInfo?.error) return <span className="text-destructive">{t("conversion:tools.merge.unreadable")}: {fileInfo.error}</span>;
                  return `${formatFileSize(file.size)}${fileInfo?.pageCount ? ` · ${t("conversion:tools.common.pages", { count: fileInfo.pageCount })}` : ""}`;
                }}
              />
            </>
          )}
        </ToolPanel>
      </main>

      <aside className="flex flex-none flex-col rounded-sm border border-border bg-surface/60 lg:min-h-0 lg:overflow-y-auto">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">{t("conversion:tools.common.options")}</h2>
        </div>
        <div className="flex-1 space-y-6 p-5">
          <TextField label={t("conversion:tools.common.documentTitle")} value={title} onChange={setTitle} />
          {files.length === 1 && <p className="text-xs text-warning">{t("conversion:tools.merge.needTwo")}</p>}
          <ToolRunStatus state={state} />
        </div>
        <div className="sticky bottom-0 border-t border-border bg-overlay p-4 backdrop-blur">
          <ToolButton variant="primary" fullWidth onClick={() => void handleRun()} disabled={files.length < 2 || running || hasUnreadable}>
            {running ? t("conversion:tools.common.running") : t("conversion:tools.merge.run", { count: files.length })}
          </ToolButton>
        </div>
      </aside>

      <LibraryPickerDialog
        open={pickerOpen}
        books={libraryPdfs}
        title={t("conversion:tools.merge.pickerTitle")}
        description={t("conversion:tools.merge.pickerDescription")}
        onClose={() => setPickerOpen(false)}
        onSelect={(book) => {
          addFiles([{
            id: createToolFileId("pdf"),
            path: book.filePath,
            name: `${getTitleWithoutExtension(book.title, book.fileType)}.pdf`,
            size: book.fileSize || 0,
            extension: "pdf",
          }]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
