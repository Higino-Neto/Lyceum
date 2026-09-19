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
    return <AnnotationEmptyState>Selecione uma nota para editar.</AnnotationEmptyState>;
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
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Editar nota</div>
          <div className="mt-1 truncate text-base font-semibold text-zinc-100">{selected.title}</div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onGoToPage(selected.page)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            title="Ir para pagina"
            aria-label="Ir para pagina"
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
                ? "border-red-700 bg-red-900/50 text-red-100"
                : "border-red-950 bg-red-950/30 text-red-300 hover:border-red-800 hover:bg-red-950",
            ].join(" ")}
            title="Excluir nota"
            aria-label="Excluir nota"
          >
            {deleteArmed ? "Confirmar" : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_76px] gap-3">
        <label className="block space-y-2 text-sm text-zinc-300"><span>Título</span><input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-zinc-100 outline-none focus:border-zinc-400"
          aria-label="Título da nota"
        /></label>
        <label className="block space-y-2 text-sm text-zinc-300"><span>Página</span><input
          value={page}
          onChange={(event) => setPage(event.target.value)}
          inputMode="numeric"
          className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          aria-label="Página da nota"
        /></label>
      </div>

      {selected.excerpt && (
        <blockquote className="max-h-24 overflow-y-auto border-l-2 border-zinc-600 pl-3 text-sm leading-relaxed text-zinc-400">
          {selected.excerpt}
        </blockquote>
      )}

      <label className="block space-y-2 text-sm text-zinc-300"><span>Conteúdo</span><textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={7}
        placeholder="Nota opcional"
        className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
      /></label>

      {duplicate && <div className="text-xs text-amber-300">Já existe uma nota com esse título.</div>}
      {pageNumber === null && <div className="text-xs text-amber-300">Informe uma página válida.</div>}

      {dirty && title.trim() && (
        <button
          type="button"
          disabled={!valid || pageNumber === null}
          onClick={() => {
            if (pageNumber !== null) {
              void onUpdate(selected.id, { title, note: nextNote, page: pageNumber });
            }
          }}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-200 px-3 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={14} />
          Salvar alterações
        </button>
      )}

      <details className="space-y-2 border-t border-zinc-800 pt-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-zinc-300">Vínculos · {related.length}</summary>
        {related.length > 0 && (
          <div className="space-y-1.5">
            {related.map((concept) => {
              const relation = relationByKey.get(relationKey({ conceptAId: selected.id, conceptBId: concept.id }));
              return (
                <div key={concept.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onGoToPage(concept.page)}
                    className="min-w-0 flex-1 truncate rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-left text-xs text-zinc-200 hover:border-zinc-700"
                  >
                    {concept.title}
                  </button>
                  {relation && (
                    <button
                      type="button"
                      onClick={() => onDeleteRelation(relation)}
                      className="flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-900 hover:text-red-300"
                      title="Remover link"
                      aria-label="Remover link"
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
          title="Adicionar link"
          onToggle={onToggleRelation}
        />
      </details>
    </section>
  );
}
