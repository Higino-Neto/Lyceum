import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../../../../i18n";

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
  const { t } = useTranslation();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-1 hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition rounded"
        title={t("dashboard:actions.previousPage")}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm text-foreground-muted">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-1 hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition rounded"
        title={t("dashboard:actions.nextPage")}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}