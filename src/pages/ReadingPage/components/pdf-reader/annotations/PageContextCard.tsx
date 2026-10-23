import { ChevronRight, FileText } from "lucide-react";
import type { ChapterRange } from "./chapterRanges";
import { useTranslation } from "../../../../../i18n";

interface PageContextCardProps {
  page: number;
  conceptCount: number;
  chapter: ChapterRange | null;
  onOpenPageConcepts: () => void;
}

export default function PageContextCard({
  page,
  conceptCount,
  chapter,
  onOpenPageConcepts,
}: PageContextCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpenPageConcepts}
      className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 rounded-sm border border-border bg-surface/70 px-3 py-3 text-left hover:border-border-strong"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-background text-foreground">
        <FileText size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-foreground-subtle">
          {t("pdf:annotations.pageContext.currentPage")}
        </span>
        <span className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold leading-none text-foreground">{page}</span>
          <span className="truncate text-[11px] text-foreground-subtle">
            {chapter?.title ?? t("pdf:annotations.pageContext.wholeBook")}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-full border border-primary bg-primary-muted px-2 py-1 text-[10px] text-primary">
          {t("pdf:annotations.pageContext.conceptCount", { count: conceptCount })}
        </span>
        <ChevronRight size={15} className="text-foreground-subtle" />
      </span>
    </button>
  );
}
