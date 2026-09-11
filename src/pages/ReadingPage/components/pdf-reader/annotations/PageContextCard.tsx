import { ChevronRight, FileText } from "lucide-react";
import type { ChapterRange } from "./chapterRanges";

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
  return (
    <button
      type="button"
      onClick={onOpenPageConcepts}
      className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-left hover:border-zinc-700"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-300">
        <FileText size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-zinc-500">Pagina atual</span>
        <span className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold leading-none text-zinc-100">{page}</span>
          <span className="truncate text-[11px] text-zinc-500">{chapter?.title ?? "Livro inteiro"}</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-2 py-1 text-[10px] text-emerald-200">
          {conceptCount} conceito{conceptCount === 1 ? "" : "s"}
        </span>
        <ChevronRight size={15} className="text-zinc-500" />
      </span>
    </button>
  );
}
