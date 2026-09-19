import type { KeyboardEvent, RefObject } from "react";
import { Save, X } from "lucide-react";
import type { KeyConcept, PdfSelectionPayload } from "../../../../../types/AnnotationTypes";
import ConceptLinkPicker from "./ConceptLinkPicker";

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
          <h3 className="text-base font-semibold text-zinc-100">Nova nota</h3>
          <p className="mt-1 text-xs text-zinc-500">Página {page}{selection ? " · vinculada ao trecho selecionado" : ""}</p>
        </div>
        <button type="button" onClick={onCloseDraft} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" aria-label="Fechar editor"><X size={16} /></button>
      </div>

      {selection?.text && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Trecho selecionado</span>
            <button type="button" onClick={onRemoveSelection} className="text-zinc-500 hover:text-zinc-100">Remover vínculo</button>
          </div>
          <blockquote className="max-h-32 overflow-y-auto border-l-2 border-zinc-600 pl-3 text-sm leading-relaxed text-zinc-300">{selection.text}</blockquote>
        </div>
      )}

      <label className="block space-y-2 text-sm text-zinc-300">
        <span>Título</span>
        <input ref={inputRef} value={title} onChange={(event) => onTitleChange(event.target.value)} onKeyDown={handleKeyDown} placeholder="Dê um nome à nota" className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-400" />
      </label>
      {duplicateTitle && <p className="text-xs text-amber-300">Já existe uma nota com esse título.</p>}

      <label className="block space-y-2 text-sm text-zinc-300">
        <span>Conteúdo <span className="text-zinc-500">(opcional)</span></span>
        <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={7} placeholder="Escreva suas ideias sobre o trecho..." className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-400" />
      </label>

      {concepts.length > 0 && (
        <details className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
          <summary className="cursor-pointer select-none">Vincular a outras notas</summary>
          <div className="pt-3"><ConceptLinkPicker concepts={concepts} selectedIds={pendingLinkedIds} title="Vínculos" onToggle={onTogglePendingLink} /></div>
        </details>
      )}

      <button type="button" disabled={!valid} onClick={onSubmit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-200 px-4 text-sm font-semibold text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={16} /> Salvar nota</button>
    </section>
  );
}
