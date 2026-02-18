import { supabase } from "../lib/supabase";

interface ReadingEntry {
  id: string;
  bookTitle: string;
  numPages: string;
  category: string;
  readingTime: string;
  date: string;
}

export default async function saveReadingEntries(entries: ReadingEntry[]) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  //   if (!userData.user) throw new Error("User is not authenticated");
  if (userError) console.error(userError);

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
      user_id: userData.user!.id,
      category_id: categoryData.id,
    };
  });
  const { data: _readingsData, error: readingsError } = await supabase
    .from("readings")
    .insert(payload);

  if (readingsError) console.error(readingsError);
}
