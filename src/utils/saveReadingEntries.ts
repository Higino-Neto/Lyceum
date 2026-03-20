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
    .select("id, title, category_id")
    .in("title", uniqueBooks);

  if (existingError) throw existingError;

  const existingBookIds = new Map(
    existingBooks?.map((b) => [b.title, { id: b.id, categoryId: b.category_id }]) ?? []
  );

  const bookCategoryMap = new Map<string, string>();
  entries.forEach((entry) => {
    if (entry.category_id && !bookCategoryMap.has(entry.bookTitle)) {
      bookCategoryMap.set(entry.bookTitle, entry.category_id);
    }
  });

  const booksToCreate = uniqueBooks.filter(
    (title) => !existingBookIds.has(title)
  );

  if (booksToCreate.length > 0) {
    const booksWithCategory = booksToCreate.map((title) => ({
      title,
      user_id: user.id,
      category_id: bookCategoryMap.get(title) || null,
    }));

    const { data: newBooks, error: booksError } = await supabase
      .from("books")
      .insert(booksWithCategory)
      .select();

    if (booksError) throw booksError;

    newBooks?.forEach((book) =>
      existingBookIds.set(book.title, { id: book.id, categoryId: book.category_id })
    );
  }

  const booksToUpdate: { id: string; category_id: string }[] = [];
  existingBooks?.forEach((book) => {
    const newCategoryId = bookCategoryMap.get(book.title);
    if (newCategoryId && book.category_id !== newCategoryId) {
      booksToUpdate.push({ id: book.id, category_id: newCategoryId });
    }
  });

  if (booksToUpdate.length > 0) {
    for (const book of booksToUpdate) {
      await supabase
        .from("books")
        .update({ category_id: book.category_id })
        .eq("id", book.id);
    }
  }

  const payload = entries.map((entry) => {
    const bookData = existingBookIds.get(entry.bookTitle);
    const bookId = entry.bookId || bookData?.id;

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