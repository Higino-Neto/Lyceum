import useGetReadings from "../hooks/useGetReadings";
import TableReading from "../types/TableReading";

export default function ReadingTableBody() {
  const readings = useGetReadings();
  return (
    <tbody>
      {readings?.map((reading: TableReading) => (
        <tr
          key={reading.id}
          className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
        >
          <td className="px-6 py-4">{reading.source_name}</td>
          <td className="px-6 py-4">{reading.pages}</td>
          <td className="px-6 py-4">{reading.reading_time} min</td>
          <td className="px-6 py-4">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(new Date(reading.reading_date))}
          </td>
        </tr>
      ))}
    </tbody>
  );
}
