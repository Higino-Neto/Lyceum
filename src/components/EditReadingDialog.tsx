import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateReadingEntry, getCategories, Category } from "../api/database";
import Select from "./ui/Select";

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
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("dialogs:editReading.errors.updateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !reading) return null;

  return (
    <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-sm w-full max-w-md mx-4 shadow-2xl shadow-shadow">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t("dialogs:editReading.title")}
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 hover:bg-surface-muted rounded-sm transition-colors"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              Livro/Fonte
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full bg-input border border-input-border rounded-sm px-4 py-2 focus:outline-none focus:border-focus-ring text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-foreground-muted mb-1">
                {t("dialogs:editReading.fields.pages")}
              </label>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="w-full bg-input border border-input-border rounded-sm px-4 py-2 focus:outline-none focus:border-focus-ring text-foreground"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-muted mb-1">
                {t("dialogs:editReading.fields.time")}
              </label>
              <input
                type="number"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full bg-input border border-input-border rounded-sm px-4 py-2 focus:outline-none focus:border-focus-ring text-foreground"
                required
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              Categoria
            </label>
            <Select value={categoryId} onChange={setCategoryId} placeholder={t("dialogs:editReading.selectPlaceholder")} className="h-10 w-full text-sm" items={categories.map((cat) => ({ value: cat.id, label: cat.name }))} />
          </div>

          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              {t("dialogs:editReading.fields.date")}
            </label>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              className="w-full bg-input border border-input-border rounded-sm px-4 py-2 focus:outline-none focus:border-focus-ring text-foreground"
              required
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
            >
              {t("dialogs:editReading.actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 cursor-pointer bg-primary hover:bg-primary-hover text-primary-foreground rounded-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading
                ? t("dialogs:editReading.actions.saving")
                : t("dialogs:editReading.actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
