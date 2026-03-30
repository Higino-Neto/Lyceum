import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { updateReadingEntry, getCategories, Category } from "../api/database";

interface EditReadingDialogProps {
  isOpen: boolean;
  reading: {
    id: string;
    source_name: string;
    pages: number;
    reading_date: string;
    reading_time: number;
    category_id?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditReadingDialog({
  isOpen,
  reading,
  onClose,
  onSuccess,
}: EditReadingDialogProps) {
  const [sourceName, setSourceName] = useState("");
  const [pages, setPages] = useState("");
  const [readingDate, setReadingDate] = useState("");
  const [readingTime, setReadingTime] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      getCategories().then(setCategories).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (reading) {
      setSourceName(reading.source_name);
      setPages(String(reading.pages));
      setReadingDate(reading.reading_date);
      setReadingTime(String(reading.reading_time));
      setCategoryId(reading.category_id || "");
    }
  }, [reading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reading) return;

    setError("");
    setIsLoading(true);

    try {
      await updateReadingEntry(
        reading.id,
        sourceName,
        parseInt(pages),
        readingDate,
        parseInt(readingTime),
        categoryId || undefined,
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !reading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">
            Editar Leitura
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 hover:bg-zinc-800 rounded-sm transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Livro/Fonte
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500 text-zinc-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Páginas
              </label>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500 text-zinc-100"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Tempo (min)
              </label>
              <input
                type="number"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500 text-zinc-100"
                required
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Categoria
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500 text-zinc-100"
              required
            >
              <option value="">Selecione...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Data</label>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500 text-zinc-100"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 cursor-pointer bg-green-500 hover:bg-green-600 text-zinc-900 rounded-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
