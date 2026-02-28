import { useNavigate } from "react-router-dom";
import useGetBookData from "./ReadingPage/hooks/useGetBookData";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

interface BookWithThumbnail extends Book {
  thumbnail?: string;
}

interface Book {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  thumbnailPath: string | null;
}

export default function Library() {
  const books = useGetBookData();
  const navigate = useNavigate();
  const [booksWithThumbnails, setBooksWithThumbnails] = useState<BookWithThumbnail[]>([]);


  useEffect(() => {
    const loadThumbnails = async () => {
      if (!books) return;
      
      const booksWithThumbs = await Promise.all(
        books.map(async (book) => {
          if (book.thumbnailPath) {
            const thumbnail = await window.api.getThumbnail(book.thumbnailPath);
            console.log(thumbnail);
            return { ...book, thumbnail: thumbnail || undefined };
          }
          return { ...book };
        })
      );
      setBooksWithThumbnails(booksWithThumbs);
    };

    loadThumbnails();
  }, [books]);

  const handleOpen = (pdfData: string) => {
    navigate("/reading", {
      state: { pdfData },
    });
  };
  return (
    <>
      <div className="h-screen flex flex-col gap-3 bg-zinc-950 p-4">
        <h1 className="text-white text-2xl font-bold mb-4">Biblioteca</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {booksWithThumbnails.map((book) => {
            return (
              <div 
                key={book.id}
                className="flex flex-col gap-2 text-white bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition cursor-pointer"
                onClick={() => handleOpen(book.filePath)}
              >
                <div className="w-full h-48 bg-zinc-800 flex items-center justify-center">
                  {book.thumbnail ? (
                    <img 
                      src={book.thumbnail} 
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText size={48} className="text-zinc-600" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-sm truncate">{book.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
