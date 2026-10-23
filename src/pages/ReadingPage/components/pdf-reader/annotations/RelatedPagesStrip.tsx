import { ChevronRight, FileText } from "lucide-react";
import type { AnnotatedPage } from "../../../../../types/AnnotationTypes";
import { useTranslation } from "../../../../../i18n";

interface RelatedPagesStripProps {
  pages: AnnotatedPage[];
  currentPage: number;
  onGoToPage: (page: number) => void;
}

export default function RelatedPagesStrip({
  pages,
  currentPage,
  onGoToPage,
}: RelatedPagesStripProps) {
  const { t } = useTranslation();
  const nearby = pages
    .filter((page) => page.conceptCount > 0)
    .sort((a, b) => Math.abs(a.page - currentPage) - Math.abs(b.page - currentPage) || a.page - b.page);
  const visible = nearby.slice(0, 4);
  const rest = Math.max(0, nearby.length - visible.length);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
        <span className="inline-flex items-center gap-2">
          <FileText size={14} />
          {t("pdf:annotations.relatedPages.title")}
        </span>
        {rest > 0 && <span className="text-[11px] font-normal text-foreground-subtle">+{rest}</span>}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-sm border border-border bg-background/60 px-3 py-4 text-center text-xs text-foreground-subtle">
          {t("pdf:annotations.relatedPages.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {visible.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => onGoToPage(item.page)}
              className={[
                "min-w-0 rounded-sm border bg-surface/70 p-1.5 text-left hover:border-border-strong",
                item.page === currentPage ? "border-primary" : "border-border",
              ].join(" ")}
            >
              <span className="block aspect-[3/4] rounded-[2px] border border-border-strong bg-background p-1">
                <span className="mb-1 block h-1.5 rounded-sm bg-border-strong" />
                <span className="mb-1 block h-1 rounded-sm bg-surface-muted" />
                <span className="mb-1 block h-1 rounded-sm bg-surface-muted" />
                <span className="block h-7 rounded-sm bg-surface-muted/70" />
              </span>
              <span className="mt-1 block truncate text-center text-[10px] text-foreground-muted">{item.page}</span>
            </button>
          ))}
          {rest > 0 && (
            <button
              type="button"
              onClick={() => onGoToPage(nearby[4]?.page ?? visible[0].page)}
              className="flex min-w-0 flex-col items-center justify-center rounded-sm border border-border bg-surface/70 p-2 text-[10px] text-foreground-subtle hover:border-border-strong hover:text-foreground"
            >
              <span>+{rest}</span>
              <span>{t("pdf:annotations.relatedPages.more")}</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
