import useGetReadings from "../../../../hooks/useGetReadings";
import TableReading from "../../../../types/TableReading";

const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

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
          <td className="px-6 py-4">{formatDate(reading.reading_date.toString())}</td>
        </tr>
      ))}
    </tbody>
  );
}
