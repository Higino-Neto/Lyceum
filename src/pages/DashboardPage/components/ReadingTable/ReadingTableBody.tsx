import { useState } from "react";
import useGetReadings from "../../../../hooks/useGetReadings";
import TableReading from "../../../../types/TableReading";
import { TableSkeleton } from "../../../../components/skeletons";
import { Trash2, Pencil } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { deleteReadingEntry } from "../../../../api/database";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import EditReadingDialog from "../../../../components/EditReadingDialog";

const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

export default function ReadingTableBody() {
  const { data: readings, isLoading } = useGetReadings();
  const queryClient = useQueryClient();

  const [deleteReading, setDeleteReading] = useState<TableReading | null>(null);
  const [editReading, setEditReading] = useState<TableReading | null>(null);

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

  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <>
      <tbody>
        {readings?.map((reading: TableReading) => (
          <tr
            key={reading.id}
            className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
          >
            <td className="px-4 py-3">{reading.source_name}</td>
            <td className="px-4 py-3">{reading.pages}</td>
            <td className="px-4 py-3">{reading.reading_time} min</td>
            <td className="px-4 py-3">
              {formatDate(reading.reading_date.toString())}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditReading(reading)}
                  className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-1"
                  title="Editar leitura"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteReading(reading)}
                  className="text-zinc-500 hover:text-red-400 transition cursor-pointer p-1"
                  title="Remover leitura"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>

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
