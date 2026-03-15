import { useEffect, useState } from "react";
import { DocumentRecord } from "../../../types/ReadingTypes";

interface BookDataResult {
  data: DocumentRecord[] | null;
  total: number;
}

export default function useGetBookData(limit?: number, offset?: number) {
  const [books, setBooks] = useState<DocumentRecord[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchBooks() {
      const result = await window.api.getDocuments(limit, offset);
      if (result) {
        setBooks(result.data);
        setTotal(result.total);
      }
    }
    fetchBooks();
  }, [limit, offset]);

  return { data: books, total };
}
