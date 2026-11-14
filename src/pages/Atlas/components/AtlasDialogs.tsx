import {
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  ReadingStatus,
} from "../../../types/LibraryTypes";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";
import Select from "../../../components/ui/Select";

interface ManualBookDialogProps {
  open: boolean;
  initialStatus?: ReadingStatus;
  onClose: () => void;
  onSubmit: (data: { title: string; author?: string | null; status: ReadingStatus }) => void;
}

export function ManualBookDialog({ open, initialStatus = "want_to_read", onClose, onSubmit }: ManualBookDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<ReadingStatus>(initialStatus);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setAuthor("");
      setStatus(initialStatus);
      return;
    }
    setStatus(initialStatus);
  }, [initialStatus, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop px-4">
      <form
        className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ title, author, status });
        }}
      >
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t("atlas:manualDialog.title")}
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("atlas:manualDialog.titlePlaceholder")}
            className="h-10 w-full rounded-sm border border-border-strong bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            autoFocus
          />
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder={t("atlas:manualDialog.authorPlaceholder")}
            className="h-10 w-full rounded-sm border border-border-strong bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <Select value={status} onChange={(value) => setStatus(value as ReadingStatus)} className="h-10 w-full text-sm" items={READING_STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-sm px-3 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground">
            {t("common:actions.cancel")}
          </button>
          <button type="submit" className="h-9 cursor-pointer rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            {t("atlas:manualDialog.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
