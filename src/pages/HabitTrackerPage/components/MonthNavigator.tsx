import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthNavigatorProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthNavigator({
  label,
  onPrevious,
  onNext,
}: MonthNavigatorProps) {
  return (
    <div className="flex items-center gap-2 rounded-sm bg-zinc-950/80 p-1 ring-1 ring-zinc-800/80 m-2">
      <button
        type="button"
        onClick={onPrevious}
        className="flex h-10 w-10 items-center justify-center rounded-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-52 px-4 text-center">
        <p className="text-sm font-medium capitalize text-zinc-100">{label}</p>
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
          acompanhamento mensal
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
        aria-label="Próximo mês"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
