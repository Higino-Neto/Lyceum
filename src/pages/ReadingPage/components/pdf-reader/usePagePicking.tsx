import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "../../../../i18n";
import { visibleSections } from "../../../../core/pdf/exercise-detection";
import { analyzePdfExercises } from "../../../../lib/pdfExerciseAnalysis";
import { CMD_SET_PAGE_PICKS, CMD_SET_PAGE_PICK_STATE } from "./pdfBridgeProtocol";

type Busy = "export" | "exercises" | null;

/**
 * Host side of page picking in the riffle dialog: exports the picked pages as
 * a new PDF (same engine as the PDF Builder) and can pre-pick the exercise
 * pages found by the exercise detector.
 */
export function usePagePicking({ filePath, fileName, postToViewer }: {
  filePath?: string;
  fileName?: string;
  postToViewer: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const busyRef = useRef<Busy>(null);
  const isPdf = Boolean(filePath && /\.pdf$/i.test(filePath));
  const exportAvailable = isPdf && Boolean(window.api?.runTool && window.api?.pickToolSavePath);
  const exercisesAvailable = isPdf && Boolean(window.api?.analyzeToolPdfExercises);

  const syncPickState = useCallback(() => {
    postToViewer(CMD_SET_PAGE_PICK_STATE, { exportAvailable, exercisesAvailable, busy: busyRef.current });
  }, [exercisesAvailable, exportAvailable, postToViewer]);

  const setBusy = useCallback((busy: Busy) => {
    busyRef.current = busy;
    syncPickState();
  }, [syncPickState]);

  useEffect(() => {
    syncPickState();
  }, [syncPickState]);

  const exportPages = useCallback(async (pages: number[]) => {
    if (!filePath || !exportAvailable || busyRef.current || pages.length === 0) return;
    const baseName = (fileName || filePath.split(/[/\\]/).pop() || "documento").replace(/\.pdf$/i, "");
    const outputPath = await window.api.pickToolSavePath("pdf", `${baseName} — ${t("pdf:pagePick.fileSuffix", { count: pages.length })}`, filePath);
    if (!outputPath) return;
    setBusy("export");
    try {
      const result = await window.api.runTool({
        operation: "build-pdf",
        input: {
          outputPath,
          title: `${baseName} — ${t("pdf:pagePick.fileSuffix", { count: pages.length })}`,
          pages: [...pages].sort((a, b) => a - b).map((page) => ({ source: filePath, kind: "pdf" as const, pageIndex: page - 1, rotation: 0 as const })),
        },
      });
      if (!result.success) {
        toast.error(t("pdf:pagePick.exportFailed", { message: result.error || "" }));
        return;
      }
      toast.success((item) => (
        <span className="flex items-center gap-3">
          {t("pdf:pagePick.exported", { count: result.pageCount ?? pages.length })}
          <button
            type="button"
            className="rounded-sm border border-border px-2 py-0.5 text-xs hover:bg-surface-muted"
            onClick={() => {
              toast.dismiss(item.id);
              void window.api.showToolOutputInFolder(outputPath);
            }}
          >
            {t("pdf:pagePick.showInFolder")}
          </button>
        </span>
      ), { duration: 8000 });
    } catch (error) {
      toast.error(t("pdf:pagePick.exportFailed", { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(null);
    }
  }, [exportAvailable, fileName, filePath, setBusy, t]);

  const pickExercises = useCallback(async () => {
    if (!filePath || !exercisesAvailable || busyRef.current) return;
    setBusy("exercises");
    try {
      const analysis = await analyzePdfExercises(filePath);
      const sections = visibleSections(analysis, { sensitivity: "balanced", includeSolutions: false, includeInline: false });
      const pages = [...new Set(sections.flatMap((section) => section.pages.map((page) => page + 1)))];
      if (pages.length === 0) {
        toast(t(analysis.textLayer === "none" ? "pdf:pagePick.exercisesNoText" : "pdf:pagePick.exercisesNone"));
        return;
      }
      postToViewer(CMD_SET_PAGE_PICKS, { pages, mode: "add" });
      toast.success(t("pdf:pagePick.exercisesPicked", { count: pages.length, sections: sections.length }));
    } catch (error) {
      toast.error(t("pdf:pagePick.exercisesFailed", { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(null);
    }
  }, [exercisesAvailable, filePath, postToViewer, setBusy, t]);

  return { syncPickState, exportPages, pickExercises };
}
