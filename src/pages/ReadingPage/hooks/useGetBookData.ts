import { useEffect, useState } from "react";
import { DocumentRecord } from "../../../types/ReadingTypes";
;
export default function useGetBookData() {
  const [books, setBooks] = useState<DocumentRecord[] | null>(null);

  useEffect(() => {
    async function fetchBooks() {
      const docs = await window.api.getDocuments();
      setBooks(docs);
    }
    fetchBooks();
  }, []);

  return books;
}
