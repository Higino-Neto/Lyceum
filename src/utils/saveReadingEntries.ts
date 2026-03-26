import { createReadingEntry, getOrCreateBook } from "../api/database";

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

  try {
    const uniqueBooks = [...new Set(entries.map((e) => e.bookTitle))];
    const bookCategoryMap = new Map<string, string>();
    entries.forEach((entry) => {
      if (entry.category_id && !bookCategoryMap.has(entry.bookTitle)) {
        bookCategoryMap.set(entry.bookTitle, entry.category_id);
      }
    });

    const bookIdMap = new Map<string, string>();
    for (const title of uniqueBooks) {
      const categoryId = bookCategoryMap.get(title) || null;
      try {
        const bookId = await getOrCreateBook(title, undefined, undefined, undefined, undefined, undefined, undefined, undefined, categoryId || undefined);
        bookIdMap.set(title, bookId);
      } catch (err) {
        console.error(`Error creating book "${title}":`, err);
        throw new Error(`Erro ao criar/atualizar livro "${title}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    for (const entry of entries) {
      const bookId = entry.bookId || bookIdMap.get(entry.bookTitle);
      try {
        await createReadingEntry(
          entry.bookTitle,
          Number(entry.numPages),
          entry.date,
          Number(entry.readingTime),
          entry.category_id,
          bookId
        );
      } catch (err) {
        console.error(`Error creating reading entry for "${entry.bookTitle}":`, err);
        throw new Error(`Erro ao registrar leitura "${entry.bookTitle}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  } catch (err) {
    console.error("saveReadingEntries error:", err);
    throw err;
  }
}
