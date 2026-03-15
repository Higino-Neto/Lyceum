import { supabase } from "../lib/supabase";
import getUser from "./getUser";

interface ReadingEntry {
  id: string;
  bookTitle: string;
  bookId?: string | null;
  numPages: string;
  category_id: string;
  readingTime: string;
  date: string;
}

export default async function saveReadingEntries(entries: ReadingEntry[]) {
  console.log("saveReadingEntries called with:", entries);
  const user = await getUser();

  const uniqueBooks = [...new Set(entries.map((e) => e.bookTitle))];

  const { data: existingBooks, error: existingError } = await supabase
    .from("books")
    .select("id, title")
    .in("title", uniqueBooks);

  if (existingError) throw existingError;

  const existingBookIds = new Map(
    existingBooks?.map((b) => [b.title, b.id]) ?? []
  );

  const booksToCreate = uniqueBooks.filter(
    (title) => !existingBookIds.has(title)
  );

  if (booksToCreate.length > 0) {
    const { data: newBooks, error: booksError } = await supabase
      .from("books")
      .insert(
        booksToCreate.map((title) => ({
          title,
          user_id: user.id,
        }))
      )
      .select();

    if (booksError) throw booksError;

    newBooks?.forEach((book) =>
      existingBookIds.set(book.title, book.id)
    );
  }

  const payload = entries.map((entry) => {
    const bookId = entry.bookId || existingBookIds.get(entry.bookTitle);

    return {
      source_name: entry.bookTitle,
      pages: Number(entry.numPages),
      reading_date: entry.date,
      reading_time: Number(entry.readingTime),
      user_id: user.id,
      category_id: entry.category_id,
      book_id: bookId ?? null,
    };
  });

  console.log("Payload to insert:", payload);

  const { error } = await supabase
    .from("readings")
    .insert(payload);

  if (error) {
    console.error(error);
    throw error;
  }
}