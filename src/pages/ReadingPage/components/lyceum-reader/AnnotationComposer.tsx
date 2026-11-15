import { useState } from "react";
import type { AnnotationTarget, LearningAnnotation } from "../../../../core/language-learning";
import { useTranslation } from "../../../../i18n";

export interface AnnotationDraftTarget {
  targetType: AnnotationTarget;
  targetId: string;
  quote: string;
  chapterId: string;
}

interface AnnotationComposerProps {
  documentId: string;
  target: AnnotationDraftTarget;
  categories: string[];
  onSave(annotation: LearningAnnotation): void;
  onCancel(): void;
}

const DEFAULT_CATEGORIES = ["expression", "grammar", "difficult", "interesting"];

/** Small inline composer; annotations reference stable element ids. */
export function AnnotationComposer({ documentId, target, categories, onSave, onCancel }: AnnotationComposerProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const suggestions = Array.from(new Set([...categories, ...DEFAULT_CATEGORIES.map((key) => t(`learning:annotations.categories.${key}` as "learning:annotations.categories.grammar"))]));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/40 pt-[18vh]" onMouseDown={onCancel}>
      <form
        className="w-full max-w-md rounded-sm border border-border-strong bg-surface p-4 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const now = new Date().toISOString();
          onSave({
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            documentId,
            targetType: target.targetType,
            targetId: target.targetId,
            chapterId: target.chapterId,
            quote: target.quote.slice(0, 2000),
            note: note.trim(),
            category: category.trim(),
            createdAt: now,
            updatedAt: now,
          });
        }}
      >
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">{t(`learning:annotations.targets.${target.targetType}` as "learning:annotations.targets.token")}</p>
        <p className="mt-1 line-clamp-3 font-serif text-sm text-foreground">“{target.quote}”</p>
        <textarea
          autoFocus
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("learning:annotations.notePlaceholder")}
          className="mt-3 w-full rounded-sm border border-input-border bg-input p-2 text-sm text-foreground focus:border-primary focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        />
        <input
          list="lx-annotation-categories"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder={t("learning:annotations.categoryPlaceholder")}
          maxLength={80}
          className="mt-2 h-8 w-full rounded-sm border border-input-border bg-input px-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
        <datalist id="lx-annotation-categories">
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-sm px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground cursor-pointer">{t("learning:actions.cancel")}</button>
          <button type="submit" className="rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover cursor-pointer">{t("learning:actions.save")}</button>
        </div>
      </form>
    </div>
  );
}
