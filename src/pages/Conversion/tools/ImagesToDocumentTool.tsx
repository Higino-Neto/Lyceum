import { useState } from "react";
import { ArrowDownAZ, ArrowUpDown, Check, FileImage, FileText, ImagePlus, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/useTranslation";
import Select from "../../../components/ui/Select";
import { formatFileSize } from "../../Library/utils";
import { NumberOption } from "../components/OptionControls";
import {
  ImageThumb,
  SortableFileList,
  TextField,
  ToolButton,
  ToolPanel,
  ToolRunStatus,
} from "./ToolShared";
import { stripExtension, toToolFiles, useToolRunner, type ToolFile } from "./toolUtils";

type OutputFormat = "pdf" | "cbz";
type PageSize = "image" | "A4" | "Letter";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export default function ImagesToDocumentTool() {
  const { t } = useTranslation();
  const [images, setImages] = useState<ToolFile[]>([]);
  const [format, setFormat] = useState<OutputFormat>("pdf");
  const [pageSize, setPageSize] = useState<PageSize>("image");
  const [marginMm, setMarginMm] = useState(0);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const { state, run, reset } = useToolRunner();
  const running = state.status === "running";

  const addImages = async () => {
    const picked = await window.api.pickToolFiles("images");
    if (picked.length === 0) return;
    reset();
    setImages((current) => [...current, ...toToolFiles(picked, "image")]);
    if (!title) setTitle(stripExtension(picked[0].name));
  };

  const handleRun = async () => {
    const outputPath = await window.api.pickToolSavePath(format, title || stripExtension(images[0]?.name || "imagens"), images[0]?.path);
    if (!outputPath) return;
    const imagePaths = images.map((image) => image.path);
    await run(format === "pdf"
      ? { operation: "images-to-pdf", input: { imagePaths, outputPath, pageSize, marginMm, title, author } }
      : { operation: "images-to-cbz", input: { imagePaths, outputPath, title, author } });
  };

  const totalSize = images.reduce((sum, image) => sum + image.size, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
      <main className="flex-none lg:min-h-0 lg:overflow-y-auto">
        <ToolPanel
          title={t("conversion:tools.images.title")}
          description={t("conversion:tools.images.description")}
          actions={
            <>
              <ToolButton onClick={() => setImages((current) => [...current].sort((a, b) => collator.compare(a.name, b.name)))} disabled={images.length < 2 || running}>
                <ArrowDownAZ size={14} />
                {t("conversion:tools.images.sortByName")}
              </ToolButton>
              <ToolButton onClick={() => setImages((current) => [...current].reverse())} disabled={images.length < 2 || running}>
                <ArrowUpDown size={14} />
                {t("conversion:tools.images.reverse")}
              </ToolButton>
              <ToolButton onClick={() => setImages([])} disabled={images.length === 0 || running}>
                <Trash2 size={14} />
                {t("conversion:tools.common.clear")}
              </ToolButton>
              <ToolButton onClick={() => void addImages()} disabled={running}>
                <ImagePlus size={14} />
                {t("conversion:tools.common.addFromComputer")}
              </ToolButton>
            </>
          }
        >
          {images.length === 0 ? (
            <button
              type="button"
              onClick={() => void addImages()}
              className="flex min-h-44 w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-foreground-subtle hover:text-foreground"
            >
              <FileImage size={24} />
              {t("conversion:tools.images.empty")}
            </button>
          ) : (
            <>
              <p className="border-b border-border px-4 py-2 text-xs text-foreground-subtle">
                {t("conversion:tools.common.files", { count: images.length })} · {formatFileSize(totalSize)} · {t("conversion:tools.common.dropHint")}
              </p>
              <SortableFileList
                items={images}
                onChange={(next) => { reset(); setImages(next); }}
                renderThumb={(image) => <ImageThumb path={image.path} />}
                renderMeta={(image) => `${image.extension.toUpperCase()} · ${formatFileSize(image.size)}`}
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
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t("conversion:tools.images.outputFormat")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(["pdf", "cbz"] as const).map((value) => {
                const selected = format === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { reset(); setFormat(value); }}
                    className={`relative rounded-sm border p-3 text-center transition-colors ${selected ? "border-primary" : "border-border bg-background hover:border-border-strong"}`}
                    aria-pressed={selected}
                  >
                    {value === "pdf"
                      ? <FileText size={20} className={selected ? "mx-auto text-primary" : "mx-auto text-foreground-muted"} />
                      : <FileImage size={20} className={selected ? "mx-auto text-primary" : "mx-auto text-foreground-muted"} />}
                    <span className="mt-2 block text-sm font-semibold text-foreground">{value.toUpperCase()}</span>
                    <span className="mt-1 block text-[11px] text-foreground-subtle">
                      {t(value === "pdf" ? "conversion:tools.images.pdfDescription" : "conversion:tools.images.cbzDescription")}
                    </span>
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {format === "pdf" && (
            <section className="space-y-3">
              <label className="block space-y-1 text-xs text-foreground-muted">
                <span>{t("conversion:tools.images.pageSize")}</span>
                <Select
                  value={pageSize}
                  onChange={(value) => setPageSize(value as PageSize)}
                  className="h-9 w-full text-sm"
                  items={[
                    { value: "image", label: t("conversion:tools.images.pageSizes.image") },
                    { value: "A4", label: t("conversion:tools.images.pageSizes.A4") },
                    { value: "Letter", label: t("conversion:tools.images.pageSizes.Letter") },
                  ]}
                />
              </label>
              {pageSize !== "image" && (
                <NumberOption label={t("conversion:tools.images.margin")} value={marginMm} min={0} max={50} suffix="mm" onChange={setMarginMm} />
              )}
            </section>
          )}

          <section className="space-y-3">
            <TextField label={t("conversion:tools.common.documentTitle")} value={title} onChange={setTitle} />
            <TextField label={t("conversion:tools.common.documentAuthor")} value={author} onChange={setAuthor} />
          </section>

          <ToolRunStatus state={state} />
        </div>
        <div className="sticky bottom-0 border-t border-border bg-overlay p-4 backdrop-blur">
          <ToolButton variant="primary" fullWidth onClick={() => void handleRun()} disabled={images.length === 0 || running}>
            {running ? t("conversion:tools.common.running") : t("conversion:tools.images.run", { format: format.toUpperCase() })}
          </ToolButton>
        </div>
      </aside>
    </div>
  );
}
