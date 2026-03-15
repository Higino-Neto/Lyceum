import { useEffect } from "react";
import useGetReadings from "../../../../hooks/useGetReadings";
import TableReading from "../../../../types/TableReading";
import { TableSkeleton } from "../../../../components/skeletons";

const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

interface ReadingTableBodyProps {
  currentPage: number;
  limit: number;
  onTotalChange?: (total: number) => void;
}

export default function ReadingTableBody({ currentPage, limit, onTotalChange }: ReadingTableBodyProps) {
  const { data, isLoading } = useGetReadings({ page: currentPage, limit });

  useEffect(() => {
    if (data?.total !== undefined && onTotalChange) {
      onTotalChange(data.total);
    }
  }, [data?.total, onTotalChange]);

  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <tbody>
      {data?.data.map((reading: TableReading) => (
        <tr
          key={reading.id}
          className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
        >
          <td className="px-6 py-4">{reading.source_name}</td>
          <td className="px-6 py-4">{reading.pages}</td>
          <td className="px-6 py-4">{reading.reading_time} min</td>
          <td className="px-6 py-4">{formatDate(reading.reading_date.toString())}</td>
        </tr>
      ))}
    </tbody>
  );
}
