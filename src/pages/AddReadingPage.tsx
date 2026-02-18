import { ArrowLeft, BookOpen, Plus, Trash2, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import saveReadingEntries from "../utils/saveReadingEntries";

interface ReadingEntry {
  id: string;
  bookTitle: string;
  numPages: string;
  category: string;
  readingTime: string;
  date: string;
}

export default function AddReadingPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ReadingEntry[]>([
    {
      id: crypto.randomUUID(),
      bookTitle: "",
      numPages: "",
      category: "",
      readingTime: "",
      date: new Date().toISOString().split("T")[0]
    }
  ]);

  const addNewEntry = () => {
    setEntries([
      ...entries,
      {
        id: crypto.randomUUID(),
        bookTitle: "",
        numPages: "",
        category: "",
        readingTime: "",
        date: new Date().toISOString().split("T")[0]
      }
    ]);
  };

  const duplicateEntry = (id: string) => {
    const entryToDuplicate = entries.find(e => e.id === id);
    if (entryToDuplicate) {
      const newEntry = {
        ...entryToDuplicate,
        id: crypto.randomUUID()
      };
      const index = entries.findIndex(e => e.id === id);
      const newEntries = [...entries];
      newEntries.splice(index + 1, 0, newEntry);
      setEntries(newEntries);
    }
  };
 
  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(entry => entry.id !== id));
    }
  };

  const updateEntry = (id: string, field: keyof ReadingEntry, value: string) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const validEntries = entries.filter(
      entry => entry.bookTitle.trim() !== "" && entry.numPages !== ""
    );
        
    await saveReadingEntries(validEntries);

    navigate("/");
  };

  // Puxar as categorias do banco de dados para fazer essa conta (Modularizar essa função)
  const calculateTotalPoints = (entry: ReadingEntry) => {
    const pages = parseInt(entry.numPages) || 0;
    const time = parseInt(entry.readingTime) || 0;
    return pages + (time * 0.5);
  };

  const calculateGrandTotal = () => {
    return entries.reduce((total, entry) => total + calculateTotalPoints(entry), 0);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="cursor-pointer flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition"
            >
              <ArrowLeft size={20} />
              <span>Dashboard</span>
            </button>
            
            <div className="flex items-center gap-3">
              <BookOpen className="text-green-500" size={24} />
              <h1 className="text-2xl font-semibold">Registrar leituras</h1>
            </div>
            
            <div className="text-green-500 font-medium">
              Total: {calculateGrandTotal()} pts
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-12 gap-3 mb-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <div className="col-span-4">Livro</div>
              <div className="col-span-1">Págs</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-1">Tempo</div>
              <div className="col-span-2">Data</div>
            </div>

            <div className="space-y-2 mb-6">
              {entries.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className="grid grid-cols-12 gap-3 items-center bg-zinc-900/30 border border-zinc-800 rounded-lg p-2 hover:border-zinc-700 transition"
                >
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={entry.bookTitle}
                      onChange={(e) => updateEntry(entry.id, "bookTitle", e.target.value)}
                      placeholder={`Livro ${index + 1}`}
                      className="w-full rounded bg-transparent border-0 focus:ring-0 text-zinc-100 placeholder:text-zinc-700 px-2 py-2 text-sm"
                      autoFocus={index === entries.length - 1}
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      value={entry.numPages}
                      onChange={(e) => updateEntry(entry.id, "numPages", e.target.value)}
                      placeholder="0"
                      min="1"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <select
                      value={entry.category}
                      onChange={(e) => updateEntry(entry.id, "category", e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="">Selecione</option>
                      <option value="fiction">Ficção</option>
                      <option value="non-fiction">Não-ficção</option>
                      <option value="sci-fi">Ficção Científica</option>
                      <option value="fantasy">Fantasia</option>
                      <option value="biography">Biografia</option>
                      <option value="history">História</option>
                      <option value="self-dev">Autoajuda</option>
                      <option value="technical">Técnico</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      value={entry.readingTime}
                      onChange={(e) => updateEntry(entry.id, "readingTime", e.target.value)}
                      placeholder="min"
                      min="1"
                      className="w-16 bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(e) => updateEntry(entry.id, "date", e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  <div className="col-span-2 flex items-between px-3 gap-2">
                    <span className="text-sm text-green-500 font-mono w-full">
                      {calculateTotalPoints(entry)}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => duplicateEntry(entry.id)}
                      className="text-zinc-500 hover:text-zinc-300 transition"
                      title="Duplicar linha"
                    >
                      <Copy size={14} />
                    </button>
                    
                      <button
                        type="button"
                        disabled={entries.length < 2}
                        onClick={() => removeEntry(entry.id)}
                        className={entries.length < 2 ? (`text-zinc-700 cursor-no-drop`) : (`text-zinc-500 hover:text-red-400 transition`)}
                        title="Remover linha"
                      >
                        <Trash2 size={14} />
                      </button>
                    
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <button
                type="button"
                onClick={addNewEntry}
                className="cursor-pointer flex items-center gap-2 text-green-500 hover:text-green-400 transition text-sm font-medium"
              >
                <Plus size={18} />
                Adicionar outra leitura
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="cursor-pointer px-6 py-2.5 border border-zinc-700 hover:border-zinc-600 rounded-lg text-zinc-300 hover:text-zinc-100 transition text-sm"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="cursor-pointer bg-green-600 hover:bg-green-500 text-black font-medium px-8 py-2.5 rounded-lg transition text-sm"
                >
                  Registrar {entries.length} leitura{entries.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}