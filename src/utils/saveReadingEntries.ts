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

  const uniqueBooks = [...new Set(entries.map((e) => e.bookTitle))];
  const { data: existingBooks } = await supabase
    .from("books")
    .select("id, title")
    .in("title", uniqueBooks);

  const existingBookIds = new Map(existingBooks?.map((b) => [b.title, b.id]) ?? []);
  const booksToCreate = uniqueBooks.filter((title) => !existingBookIds.has(title));

  if (booksToCreate.length > 0) {
    const { data: newBooks, error: booksError } = await supabase
      .from("books")
      .insert(booksToCreate.map((title) => ({ title, user_id: user.id })))
      .select();

    if (booksError) {
      console.error("Failed to create books:", booksError);
    } else if (newBooks) {
      newBooks.forEach((book) => existingBookIds.set(book.title, book.id));
    }
  }

  const payload = await Promise.all(
    entries.map(async (entry) => {
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", entry.category)
        .single();

      if (categoryError || !categoryData) {
        throw new Error(`Category not found: ${entry.category}`);
      }

      return {
        source_name: entry.bookTitle,
        pages: Number(entry.numPages),
        reading_date: entry.date,
        reading_time: Number(entry.readingTime),
        user_id: user.id,
        category_id: categoryData.id,
        book_id: existingBookIds.get(entry.bookTitle),
      };
    }),
  );

  const { error: readingsError } = await supabase
    .from("readings")
    .insert(payload);

  if (readingsError) console.error(readingsError);
}
