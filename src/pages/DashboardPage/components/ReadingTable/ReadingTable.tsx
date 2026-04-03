import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import ReadingTableBody from "./ReadingTableBody";
import ReadingTableHeader from "./ReadingTableHeader";
import TablePagination from "./TablePagination";
import TableReading from "../../../../types/TableReading";
import { deleteReadingEntry } from "../../../../api/database";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import EditReadingDialog from "../../../../components/EditReadingDialog";

const ITEMS_PER_PAGE = 10;

export default function ReadingTable() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteReading, setDeleteReading] = useState<TableReading | null>(null);
  const [editReading, setEditReading] = useState<TableReading | null>(null);

  useEffect(() => {
    queryClient.fetchQuery({ queryKey: ["readings"] }).then((data) => {
      if (Array.isArray(data)) {
        setTotalItems(data.length);
      }
    });
  }, [queryClient]);

  const handleTotalPagesChange = (total: number) => {
    setTotalItems(total);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReadingEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readings"] });
      toast.success("Leitura removida!");
      setDeleteReading(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <div className="overflow-hidden rounded-sm border border-zinc-800">
        <table className="w-full text-sm">
          <ReadingTableHeader />
          <ReadingTableBody 
            onlyTable 
            onEdit={setEditReading} 
            onDelete={setDeleteReading}
            currentPage={currentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            onTotalPagesChange={handleTotalPagesChange}
          />
        </table>
        <TablePagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>
      <ReadingTableBody onEdit={setEditReading} onDelete={setDeleteReading} />

      <ConfirmDialog
        isOpen={!!deleteReading}
        title="Excluir Leitura"
        message={`Tem certeza que deseja excluir "${deleteReading?.source_name}"?`}
        confirmLabel="Excluir"
        onConfirm={() => deleteReading && deleteMutation.mutate(deleteReading.id)}
        onCancel={() => setDeleteReading(null)}
        isDanger
      />

      <EditReadingDialog
        isOpen={!!editReading}
        reading={editReading}
        onClose={() => setEditReading(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["readings"] });
          toast.success("Leitura atualizada!");
        }}
      />
    </>
  );
}