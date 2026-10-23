import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2Off, Save, Trash2 } from "lucide-react";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import AnnotationEmptyState from "./AnnotationEmptyState";
import {
  clampConceptPage,
  findDuplicateTitle,
  normalizeTitle,
} from "./annotationPanelUtils";
import ConceptLinkPicker from "./ConceptLinkPicker";
import { relationKey } from "./graphModel";
import { useTranslation } from "../../../../../i18n";

interface ConceptEditorProps {
  selected: KeyConcept | null;
  concepts: KeyConcept[];
  related: KeyConcept[];
  relations: ConceptRelation[];
  totalPages: number;
  onUpdate: (id: string, updates: { title: string; note: string | null; page: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteRelation: (relation: ConceptRelation) => Promise<void>;
  onToggleRelation: (id: string) => void;
  onGoToPage: (page: number) => void;
}

export default function ConceptEditor({
  selected,
  concepts,
  related,
  relations,
  totalPages,
  onUpdate,
  onDelete,
  onDeleteRelation,
  onToggleRelation,
  onGoToPage,
}: ConceptEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [page, setPage] = useState("1");
  const [note, setNote] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    setTitle(selected?.title ?? "");
    setPage(String(selected?.page ?? 1));
    setNote(selected?.note ?? "");
    setDeleteArmed(false);
  }, [selected]);

  const relationByKey = useMemo(
    () => new Map(relations.map((relation) => [relationKey(relation), relation])),
    [relations],
  );

  if (!selected) {
    return <AnnotationEmptyState>{t("pdf:annotations.editor.empty")}</AnnotationEmptyState>;
  }

  const pageNumber = clampConceptPage(page, totalPages);
  const duplicate = findDuplicateTitle(concepts, title, selected.id);
  const titleChanged = normalizeTitle(title) !== normalizeTitle(selected.title);
  const pageChanged = pageNumber !== null && pageNumber !== selected.page;
  const nextNote = note.trim() || null;
  const noteChanged = (nextNote || "") !== (selected.note || "");
  const dirty = titleChanged || pageChanged || noteChanged;
  const valid = Boolean(title.trim()) && pageNumber !== null && !duplicate;
  const selectedLinkIds = new Set(related.map((concept) => concept.id));

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">Editar nota</div>
          <div className="mt-1 truncate text-base font-semibold text-foreground">{selected.title}</div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onGoToPage(selected.page)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong bg-surface text-foreground hover:bg-surface-muted hover:text-foreground"
            title={t("pdf:annotations.editor.goToPageTitle")}
            aria-label={t("pdf:annotations.editor.goToPageAriaLabel", {
              page: selected.page,
            })}
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteArmed) void onDelete(selected.id);
              else setDeleteArmed(true);
            }}
            className={[
              "flex h-8 items-center justify-center rounded-sm border px-2 text-xs transition",
              deleteArmed
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "border-destructive bg-destructive-muted text-destructive hover:border-destructive hover:bg-destructive-hover",
            ].join(" ")}
            title={t("pdf:annotations.editor.deleteTitle")}
            aria-label={t("pdf:annotations.editor.deleteAriaLabel")}
          >
            {deleteArmed ? t("pdf:annotations.editor.confirmDelete") : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_76px] gap-3">
        <label className="block space-y-2 text-sm text-foreground"><span>{t("pdf:annotations.editor.titleLabel")}</span><input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-border-strong"
          aria-label={t("pdf:annotations.editor.titleAriaLabel")}
        /></label>
        <label className="block space-y-2 text-sm text-foreground"><span>{t("pdf:annotations.editor.pageLabel")}</span><input
          value={page}
          onChange={(event) => setPage(event.target.value)}
          inputMode="numeric"
          className="h-10 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground outline-none focus:border-border-strong"
          aria-label={t("pdf:annotations.editor.pageAriaLabel")}
        /></label>
      </div>

      {selected.excerpt && (
        <blockquote className="max-h-24 overflow-y-auto border-l-2 border-border-strong pl-3 text-sm leading-relaxed text-foreground-muted">
          {selected.excerpt}
        </blockquote>
      )}

      <label className="block space-y-2 text-sm text-foreground"><span>{t("pdf:annotations.editor.contentLabel")}</span><textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={7}
        placeholder={t("pdf:annotations.editor.notePlaceholder")}
        className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-input-placeholder focus:border-border-strong"
      /></label>

      {duplicate && (
        <div className="text-xs text-warning">{t("pdf:annotations.editor.duplicateTitle")}</div>
      )}
      {pageNumber === null && (
        <div className="text-xs text-warning">{t("pdf:annotations.editor.invalidPage")}</div>
      )}

      {dirty && title.trim() && (
        <button
          type="button"
          disabled={!valid || pageNumber === null}
          onClick={() => {
            if (pageNumber !== null) {
              void onUpdate(selected.id, { title, note: nextNote, page: pageNumber });
            }
          }}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-muted px-3 text-sm font-medium text-foreground transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={14} />
          {t("pdf:annotations.editor.save")}
        </button>
      )}

      <details className="space-y-2 border-t border-border pt-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
          {t("pdf:annotations.editor.linksSummary", { count: related.length })}
        </summary>
        {related.length > 0 && (
          <div className="space-y-1.5">
            {related.map((concept) => {
              const relation = relationByKey.get(relationKey({ conceptAId: selected.id, conceptBId: concept.id }));
              return (
                <div key={concept.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onGoToPage(concept.page)}
                    className="min-w-0 flex-1 truncate rounded-sm border border-border bg-surface px-2 py-1.5 text-left text-xs text-foreground hover:border-border-strong"
                  >
                    {concept.title}
                  </button>
                  {relation && (
                    <button
                      type="button"
                      onClick={() => onDeleteRelation(relation)}
                      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-surface text-foreground-muted hover:border-destructive hover:text-destructive"
                      title={t("pdf:annotations.editor.removeLinkTitle")}
                      aria-label={t("pdf:annotations.editor.removeLinkAriaLabel")}
                    >
                      <Link2Off size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <ConceptLinkPicker
          concepts={concepts}
          selectedIds={selectedLinkIds}
          excludeId={selected.id}
          title={t("pdf:annotations.editor.addLink")}
          onToggle={onToggleRelation}
        />
      </details>
    </section>
  );
}
