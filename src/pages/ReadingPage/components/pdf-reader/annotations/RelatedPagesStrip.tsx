import { ChevronRight, FileText } from "lucide-react";
import type { AnnotatedPage } from "../../../../../types/AnnotationTypes";

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
  const nearby = pages
    .filter((page) => page.conceptCount > 0)
    .sort((a, b) => Math.abs(a.page - currentPage) - Math.abs(b.page - currentPage) || a.page - b.page);
  const visible = nearby.slice(0, 4);
  const rest = Math.max(0, nearby.length - visible.length);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
        <span className="inline-flex items-center gap-2">
          <FileText size={14} />
          Paginas relacionadas
        </span>
        {rest > 0 && <span className="text-[11px] font-normal text-zinc-500">+{rest}</span>}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 px-3 py-4 text-center text-xs text-zinc-500">
          Nenhuma pagina anotada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {visible.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => onGoToPage(item.page)}
              className={[
                "min-w-0 rounded-sm border bg-zinc-900/70 p-1.5 text-left hover:border-zinc-700",
                item.page === currentPage ? "border-emerald-500" : "border-zinc-800",
              ].join(" ")}
            >
              <span className="block aspect-[3/4] rounded-[2px] border border-zinc-700 bg-zinc-950 p-1">
                <span className="mb-1 block h-1.5 rounded-sm bg-zinc-700" />
                <span className="mb-1 block h-1 rounded-sm bg-zinc-800" />
                <span className="mb-1 block h-1 rounded-sm bg-zinc-800" />
                <span className="block h-7 rounded-sm bg-zinc-800/70" />
              </span>
              <span className="mt-1 block truncate text-center text-[10px] text-zinc-400">{item.page}</span>
            </button>
          ))}
          {rest > 0 && (
            <button
              type="button"
              onClick={() => onGoToPage(nearby[4]?.page ?? visible[0].page)}
              className="flex min-w-0 flex-col items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900/70 p-2 text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
            >
              <span>+{rest}</span>
              <span>mais</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
