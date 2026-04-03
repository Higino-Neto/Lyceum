import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function TablePagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-3 border-t border-zinc-800">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-1 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition rounded"
        title="Página anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm text-zinc-400">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-1 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition rounded"
        title="Próxima página"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}