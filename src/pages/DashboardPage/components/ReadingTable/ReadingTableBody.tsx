import useGetReadings from "../../../../hooks/useGetReadings";
import TableReading from "../../../../types/TableReading";
import { TableSkeleton } from "../../../../components/skeletons";
import { Trash2, Pencil } from "lucide-react";

const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

interface ReadingTableBodyProps {
  onlyTable?: boolean;
  onEdit?: (reading: TableReading) => void;
  onDelete?: (reading: TableReading) => void;
}

export default function ReadingTableBody({ onlyTable = false, onEdit, onDelete }: ReadingTableBodyProps) {
  const { data: readings, isLoading } = useGetReadings();

  if (isLoading) {
    return onlyTable ? <TableSkeleton rows={5} /> : null;
  }

  if (onlyTable) {
    return (
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
                  onClick={() => onEdit?.(reading)}
                  className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-1"
                  title="Editar leitura"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(reading)}
                  className="text-zinc-500 hover:text-red-400 transition cursor-pointer p-1"
                  title="Remover leitura"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    );
  }

  return null;
}
