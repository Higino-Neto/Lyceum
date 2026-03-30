import { useState, useEffect, useMemo } from "react";
import { SupabaseBook, BookReading, getBookReadings } from "../../../api/database";
import { X, Edit3, Trash2, FileText, BookOpen, Clock, Calendar } from "lucide-react";

interface StatisticsPanelProps {
  book: SupabaseBook | null;
  onClose: () => void;
  onEdit: (book: SupabaseBook) => void;
  onDelete: (book: SupabaseBook) => void;
}

export default function StatisticsPanel({ book, onClose, onEdit, onDelete }: StatisticsPanelProps) {
  const [bookReadings, setBookReadings] = useState<BookReading[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (book) {
      setLoading(true);
      getBookReadings(book.id)
        .then(setBookReadings)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setBookReadings([]);
    }
  }, [book]);

  const totalPages = useMemo(() => {
    return bookReadings.reduce((sum, r) => sum + r.pages, 0);
  }, [bookReadings]);

  const totalTime = useMemo(() => {
    return bookReadings.reduce((sum, r) => sum + (r.reading_time || 0), 0);
  }, [bookReadings]);

  const formatTime = (minutes: number) => {
    if (minutes === 0) return "0 min";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  if (!book) return null;

  return (
    <div className="overflow-hidden w-100 bg-zinc-900 shadow-2xl z-50 flex flex-col h-full max-h-[calc(100vh-8.5rem)]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Estatísticas</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer"
        >
          <X size={20} className="text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 bg-zinc-800 rounded-sm">
          <p className="text-sm text-zinc-200 font-medium line-clamp-2">{book.title}</p>
          <p className="text-xs text-zinc-500 mt-1">{book.author || "Autor desconhecido"}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-zinc-800 rounded-sm text-center">
            <p className="text-lg font-semibold text-green-500">{totalPages}</p>
            <p className="text-xs text-zinc-500">páginas</p>
          </div>
          <div className="p-3 bg-zinc-800 rounded-sm text-center">
            <p className="text-lg font-semibold text-zinc-200">{bookReadings.length}</p>
            <p className="text-xs text-zinc-500">registros</p>
          </div>
          <div className="p-3 bg-zinc-800 rounded-sm text-center">
            <p className="text-lg font-semibold text-zinc-200">{formatTime(totalTime)}</p>
            <p className="text-xs text-zinc-500">tempo</p>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Histórico de Leituras</h3>
          {loading ? (
            <div className="text-center py-4">
              <p className="text-xs text-zinc-500">Carregando...</p>
            </div>
          ) : bookReadings.length === 0 ? (
            <div className="text-center py-4">
              <BookOpen size={32} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500">Nenhum registro de leitura</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bookReadings.map((reading) => (
                <div key={reading.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-sm">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-zinc-500" />
                    <div>
                      <p className="text-sm text-zinc-300">{reading.pages} páginas</p>
                      {reading.reading_time && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(reading.reading_time)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Calendar size={12} />
                    <span className="text-xs">{formatDate(reading.reading_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <button
          onClick={() => onEdit(book)}
          className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-3 rounded-sm font-medium transition-colors cursor-pointer"
        >
          <Edit3 size={16} />
          Editar Livro
        </button>
        <button
          onClick={() => {
            if (confirm(`Tem certeza que deseja excluir "${book.title}"?`)) {
              onDelete(book);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-sm transition-colors cursor-pointer bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
        >
          <Trash2 size={16} />
          Excluir Livro
        </button>
      </div>
    </div>
  );
}
