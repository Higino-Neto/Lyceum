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
    const bookId = await getOrCreateBook(title, undefined, undefined, undefined, undefined, undefined, undefined, undefined, categoryId || undefined);
    bookIdMap.set(title, bookId);
  }

  for (const entry of entries) {
    const bookId = entry.bookId || bookIdMap.get(entry.bookTitle);
    await createReadingEntry(
      entry.bookTitle,
      Number(entry.numPages),
      entry.date,
      Number(entry.readingTime),
      entry.category_id,
      bookId
    );
  }
}
