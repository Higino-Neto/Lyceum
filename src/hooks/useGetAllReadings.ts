import { useQuery } from "@tanstack/react-query";
import getReadings from "../utils/getReadings";

export default function useGetAllReadings() {
  return useQuery({
    queryKey: ["readings-all"],
    queryFn: () => getReadings(1, 10000),
  });
}
