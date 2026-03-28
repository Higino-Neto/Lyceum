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
      
      const entriesWithThisTitle = entries.filter(e => e.bookTitle === title);
      const existingBookId = entriesWithThisTitle.find(e => e.bookId)?.bookId;
      
      if (existingBookId && existingBookId.startsWith('local-')) {
        bookIdMap.set(title, null);
        continue;
      }
      
      if (existingBookId && !existingBookId.startsWith('local-') && existingBookId.length === 36) {
        bookIdMap.set(title, existingBookId);
        continue;
      }
      
      const fileHash = existingBookId;
      
      try {
        let bookId: string;
        
        if (fileHash && window.api) {
          bookId = await getOrCreateBook(title, undefined, undefined, undefined, undefined, undefined, undefined, undefined, categoryId || undefined);
          
          try {
            const doc = await window.api.getDocumentByTitle(title);
            if (doc && !doc.bookId) {
              await window.api.updateBookId(doc.fileHash, bookId);
            }
          } catch (linkErr) {
            console.warn(`Could not link document to book "${title}":`, linkErr);
          }
        } else {
          bookId = await getOrCreateBook(title, undefined, undefined, undefined, undefined, undefined, undefined, undefined, categoryId || undefined);
        }
        
        bookIdMap.set(title, bookId);
      } catch (err) {
        console.error(`Error creating book "${title}":`, err);
        throw new Error(`Erro ao criar/atualizar livro "${title}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    for (const entry of entries) {
      const bookId = bookIdMap.get(entry.bookTitle);
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
