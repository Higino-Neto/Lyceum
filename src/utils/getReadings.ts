import { supabase } from "../lib/supabase";
import getUser from "./getUser";

export default async function getReadings(page: number = 1, limit: number = 10) {
  const user = await getUser();
  const offset = (page - 1) * limit;

  const { data: readingsData, error: readingsError, count } = await supabase
    .from("readings")
    .select("id, source_name, pages, reading_date, reading_time, category_id", { count: "exact" })
    .eq("user_id", user.id)
    .order("reading_date", {
      ascending: false,
    })
    .range(offset, offset + limit - 1);

  if (readingsError) {
    throw readingsError;
  }

  return { data: readingsData, total: count || 0 };
}
