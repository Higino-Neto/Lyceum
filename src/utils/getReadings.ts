import { supabase } from "../lib/supabase";
import getUser from "./getUser";

export default async function getReadings() {
  const user = await getUser();

  const { data: readingsData, error: readingsError } = await supabase
    .from("readings")
    .select("id, source_name, pages, reading_date, reading_time")
    .eq("user_id", user.id);

  if (readingsError) {
    throw readingsError;
  }

  return readingsData;
}
