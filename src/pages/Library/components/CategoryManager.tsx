import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Tag,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";

interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange: () => void;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
  "#84cc16", "#06b6d4", "#0ea5e9", "#a855f7", "#f43f5e",
];

export default function CategoryManager({
  isOpen,
  onClose,
  onCategoriesChange,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await window.api.categoryGetAll();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    try {
      const result = await window.api.categoryCreate(newName.trim(), newColor);
      if (result) {
        toast.success(`Categoria "${result.name}" criada!`);
        await loadCategories();
        onCategoriesChange();
        setIsCreating(false);
        setNewName("");
        setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      }
    } catch (error) {
      toast.error("Erro ao criar categoria");
    }
  };

  const handleUpdate = async (id: number) => {
    if (!newName.trim()) return;
    
    try {
      const success = await window.api.categoryUpdate(id, newName.trim(), newColor);
      if (success) {
        toast.success("Categoria atualizada!");
        await loadCategories();
        onCategoriesChange();
        setEditingId(null);
        setNewName("");
      }
    } catch (error) {
      toast.error("Erro ao atualizar categoria");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir categoria "${name}"?`)) return;
    
    try {
      const success = await window.api.categoryDelete(id);
      if (success) {
        toast.success(`Categoria "${name}" excluída!`);
        await loadCategories();
        onCategoriesChange();
      }
    } catch (error) {
      toast.error("Erro ao excluir categoria");
    }
  };

  const startEditing = (cat: BookCategory) => {
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewColor(cat.color);
    setIsCreating(false);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingId(null);
    setNewName("");
    setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
    setNewName("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-sm w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Gerenciar Categorias</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-sm transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && categories.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">Carregando...</div>
          ) : categories.length === 0 && !isCreating ? (
            <div className="text-center py-8">
              <Tag size={32} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-zinc-500 text-sm">Nenhuma categoria ainda.</p>
              <p className="text-zinc-600 text-xs mt-1">Crie categorias para organizar seus livros.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-3 bg-zinc-800 rounded-sm"
              >
                {editingId === cat.id ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer"
                      style={{ backgroundColor: newColor }}
                      onClick={() => {
                        const idx = PRESET_COLORS.indexOf(newColor);
                        setNewColor(PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]);
                      }}
                    />
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(cat.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      className="p-1.5 hover:bg-zinc-700 rounded text-zinc-300"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 truncate">{cat.name}</p>
                      <p className="text-xs text-zinc-500">
                        {cat.bookCount} livro{cat.bookCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => startEditing(cat)}
                      className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))
          )}

          {isCreating && (
            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-sm border border-zinc-600">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: newColor }}
                onClick={() => {
                  const idx = PRESET_COLORS.indexOf(newColor);
                  setNewColor(PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]);
                }}
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da categoria..."
                className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <button
                onClick={handleCreate}
                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-300"
              >
                <Check size={16} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-700">
          {isCreating || editingId ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Clique na cor para mudar:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                      newColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={startCreating}
              className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-2.5 rounded-sm font-medium transition-colors cursor-pointer"
            >
              <Plus size={18} />
              Nova Categoria
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
