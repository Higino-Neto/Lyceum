import type { KeyboardEvent, RefObject } from "react";
import { Save, X } from "lucide-react";
import type { KeyConcept, PdfSelectionPayload } from "../../../../../types/AnnotationTypes";
import ConceptLinkPicker from "./ConceptLinkPicker";
import { useTranslation } from "../../../../../i18n";

interface ConceptComposerProps {
  inputRef: RefObject<HTMLInputElement>;
  title: string;
  note: string;
  page: number;
  selection: PdfSelectionPayload | null;
  concepts: KeyConcept[];
  pendingLinkedIds: Set<string>;
  duplicateTitle: boolean;
  valid: boolean;
  onCloseDraft: () => void;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onRemoveSelection: () => void;
  onTogglePendingLink: (id: string) => void;
}

export default function ConceptComposer({
  inputRef, title, note, page, selection, concepts, pendingLinkedIds,
  duplicateTitle, valid, onCloseDraft, onTitleChange, onNoteChange,
  onSubmit, onRemoveSelection, onTogglePendingLink,
}: ConceptComposerProps) {
  const { t } = useTranslation();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (valid) onSubmit();
    }
  };

  return (
    <section className="space-y-5 px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">
            {t("pdf:annotations.composer.title")}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {t("pdf:annotations.composer.page", { page })}
            {selection ? t("pdf:annotations.composer.linkedToSelection") : ""}
          </p>
        </div>
        <button type="button" onClick={onCloseDraft} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" aria-label={t("pdf:annotations.composer.closeAriaLabel")}><X size={16} /></button>
      </div>

      {selection?.text && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>{t("pdf:annotations.composer.selectedExcerpt")}</span>
            <button
              type="button"
              onClick={onRemoveSelection}
              className="text-zinc-500 hover:text-zinc-100"
            >
              {t("pdf:annotations.composer.removeLink")}
            </button>
          </div>
          <blockquote className="max-h-32 overflow-y-auto border-l-2 border-zinc-600 pl-3 text-sm leading-relaxed text-zinc-300">{selection.text}</blockquote>
        </div>
      )}

      <label className="block space-y-2 text-sm text-zinc-300">
        <span>{t("pdf:annotations.composer.titleLabel")}</span>
        <input ref={inputRef} value={title} onChange={(event) => onTitleChange(event.target.value)} onKeyDown={handleKeyDown} placeholder={t("pdf:annotations.composer.titlePlaceholder")} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-400" />
      </label>
      {duplicateTitle && (
        <p className="text-xs text-amber-300">{t("pdf:annotations.composer.duplicateTitle")}</p>
      )}

      <label className="block space-y-2 text-sm text-zinc-300">
        <span>
          {t("pdf:annotations.composer.contentLabel")}{" "}
          <span className="text-zinc-500">{t("pdf:annotations.composer.optional")}</span>
        </span>
        <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={7} placeholder={t("pdf:annotations.composer.notePlaceholder")} className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-400" />
      </label>

      {concepts.length > 0 && (
        <details className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
          <summary className="cursor-pointer select-none">
            {t("pdf:annotations.composer.linkSection")}
          </summary>
          <div className="pt-3">
            <ConceptLinkPicker
              concepts={concepts}
              selectedIds={pendingLinkedIds}
              title={t("pdf:annotations.editor.linksLabel")}
              onToggle={onTogglePendingLink}
            />
          </div>
        </details>
      )}

      <button type="button" disabled={!valid} onClick={onSubmit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-200 px-4 text-sm font-semibold text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={16} /> {t("pdf:annotations.composer.save")}</button>
    </section>
  );
}
