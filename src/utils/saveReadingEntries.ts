import { supabase } from "../lib/supabase";
import getUser from "./getUser";

interface ReadingEntry {
  id: string;
  bookTitle: string;
  numPages: string;
  category: string;
  readingTime: string;
  date: string;
}

export default async function saveReadingEntries(entries: ReadingEntry[]) {
  const user = await getUser();
  const { data: categoriesData, error: categoriesError } = await supabase
    .from("categories").select();
  if (categoriesError || !categoriesData) {
    throw categoriesError ?? new Error("Failed to load categories");
  }
  console.log(categoriesData)

  const payload = entries.map((entry) => {
    const categoryData = categoriesData?.find(
      (category) => category.name === entry.category,
    );
    if (!categoryData) {
      throw new Error(`Category not found: ${entry.category}`);
    }

    return {
      source_name: entry.bookTitle,
      pages: Number(entry.numPages),
      reading_date: entry.date,
      reading_time: Number(entry.readingTime),
      user_id: user.id,
      category_id: categoryData.id,
    };
  });
  const { data: _readingsData, error: readingsError } = await supabase
    .from("readings")
    .insert(payload);

  if (readingsError) console.error(readingsError);
}
