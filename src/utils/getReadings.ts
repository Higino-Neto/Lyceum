import { supabase } from "../lib/supabase";
import getUser from "./getUser";

// TODO Adicionar page limit para fazer pagination

export default async function getReadings() {
  const user = await getUser();

  const { data: readingsData, error: readingsError } = await supabase
    .from("readings")
    .select("id, source_name, pages, reading_date, reading_time, category_id")
    .eq("user_id", user.id)
    .order("reading_date", {
      ascending: false,
    });

  if (readingsError) {
    throw readingsError;
  }

  return readingsData;
}
