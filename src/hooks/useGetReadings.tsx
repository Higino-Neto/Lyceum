import { useQuery } from "@tanstack/react-query";
import getReadings from "../utils/getReadings";
import TableReading from "../types/TableReading";

export default function useGetReadings() {
  return useQuery<TableReading[]>({
    queryKey: ["readings"],
    queryFn: getReadings,
  });
}
