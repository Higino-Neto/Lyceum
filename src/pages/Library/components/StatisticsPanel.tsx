import { useState, useEffect, useMemo } from "react";
import { SupabaseBook, BookReading, getBookReadings } from "../../../api/database";
import { FileBarChart, PanelLeftClose } from "lucide-react";

interface StatisticsPanelProps {
  book: SupabaseBook | null;
  onClose: () => void;
}

export default function StatisticsPanel({ book, onClose }: StatisticsPanelProps) {
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

  if (!book) {
    return (
      <aside className="w-72 flex-shrink-0 bg-zinc-900/50 border-l border-zinc-800 p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <FileBarChart size={16} />
            <span className="text-sm font-medium">Estatísticas</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-500"
            title="Ocultar painel"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="text-center py-8">
          <FileBarChart size={32} className="mx-auto text-zinc-600 mb-2" />
          <p className="text-xs text-zinc-500">Selecione um livro para ver as estatísticas</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-zinc-900/50 border-l border-zinc-800 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <FileBarChart size={16} />
          <span className="text-sm font-medium">Estatísticas</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-500"
          title="Ocultar painel"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-zinc-800/50 rounded-sm">
          <p className="text-xs text-zinc-500 mb-1">Livro selecionado</p>
          <p className="text-sm text-zinc-200 font-medium line-clamp-2">{book.title}</p>
          <p className="text-xs text-zinc-500 mt-1">{book.author || 'Autor desconhecido'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-zinc-800/50 rounded-sm text-center">
            <p className="text-lg font-semibold text-zinc-200">{totalPages}</p>
            <p className="text-xs text-zinc-500">páginas lidas</p>
          </div>
          <div className="p-3 bg-zinc-800/50 rounded-sm text-center">
            <p className="text-lg font-semibold text-zinc-200">{bookReadings.length}</p>
            <p className="text-xs text-zinc-500">registros</p>
          </div>
        </div>

        {bookReadings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium">Histórico de leituras</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {bookReadings.map((reading) => (
                <div key={reading.id} className="flex items-center justify-between text-xs p-2 bg-zinc-800/30 rounded-sm">
                  <span className="text-zinc-400">{reading.pages} páginas</span>
                  <span className="text-zinc-500">
                    {new Date(reading.reading_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded-sm transition-colors"
        >
          Limpar seleção
        </button>
      </div>
    </aside>
  );
}
