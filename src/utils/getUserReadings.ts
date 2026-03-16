import { supabase } from "../lib/supabase";

interface ReadingData {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  category_id: string | null;
}

export default async function getUserReadings(userId: string): Promise<ReadingData[]> {
  const { data: readingsData, error: readingsError } = await supabase.rpc("get_user_readings", {
    p_user_id: userId,
  });

  if (readingsError) {
    throw readingsError;
  }

  return readingsData || [];
}
