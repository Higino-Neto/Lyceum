import { useEffect, useState } from "react";
import getReadings from "../utils/getReadings";
import TableReading from "../types/TableReading";


export default function useGetReadings() {
  const [readings, setReadings] = useState<TableReading[]>([]);
  useEffect(() => {
    const handleGetReadings = async () => {
      const readingsData = await getReadings();
      setReadings(readingsData);
    };
    handleGetReadings();
  }, []);

  return readings;
}
