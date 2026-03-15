import { useQuery } from "@tanstack/react-query";
import getReadings from "../utils/getReadings";
import TableReading from "../types/TableReading";

interface UseGetReadingsOptions {
  page?: number;
  limit?: number;
}

export default function useGetReadings({ page = 1, limit = 10 }: UseGetReadingsOptions = {}) {
  return useQuery<{ data: TableReading[]; total: number }>({
    queryKey: ["readings", page, limit],
    queryFn: () => getReadings(page, limit),
  });
}
