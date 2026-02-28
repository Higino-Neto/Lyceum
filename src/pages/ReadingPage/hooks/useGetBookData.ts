import { useEffect, useState } from "react";

interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  createdAt: string;
}

export default function useGetBookData() {
  const [bookData, setBookData] = useState<DocumentRecord[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const documents = await window.api.getDocuments();
      if (!documents) return;
      setBookData(documents);
    };

    load();
  }, []);

  return bookData;
}
