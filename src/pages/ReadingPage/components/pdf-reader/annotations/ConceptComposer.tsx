import type { KeyboardEvent, RefObject } from "react";
import { FileText, MoreVertical, MousePointer2, Plus, Save, X } from "lucide-react";
import type { KeyConcept, PdfSelectionPayload } from "../../../../../types/AnnotationTypes";
import ConceptLinkPicker from "./ConceptLinkPicker";

interface ConceptComposerProps {
  inputRef: RefObject<HTMLInputElement>;
  open: boolean;
  title: string;
  note: string;
  page: number;
  selection: PdfSelectionPayload | null;
  concepts: KeyConcept[];
  pendingLinkedIds: Set<string>;
  duplicateTitle: boolean;
  valid: boolean;
  hasPendingSelection: boolean;
  onOpenBlank: () => void;
  onOpenFromSelection: () => void;
  onCloseDraft: () => void;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onRemoveSelection: () => void;
  onTogglePendingLink: (id: string) => void;
}

function Kbd({ children }: { children: string }) {
  return (
    <span className="ml-auto rounded-sm border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-400">
      {children}
    </span>
  );
}

export default function ConceptComposer({
  inputRef,
  open,
  title,
  note,
  page,
  selection,
  concepts,
  pendingLinkedIds,
  duplicateTitle,
  valid,
  hasPendingSelection,
  onOpenBlank,
  onOpenFromSelection,
  onCloseDraft,
  onTitleChange,
  onNoteChange,
  onSubmit,
  onRemoveSelection,
  onTogglePendingLink,
}: ConceptComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <section className="space-y-2 border-b border-zinc-800 px-3 py-3">
      <div className="grid grid-cols-[1fr_38px] gap-2">
        <button
          type="button"
          onClick={onOpenBlank}
          className="inline-flex h-10 min-w-0 items-center gap-2 rounded-sm border border-emerald-600 bg-emerald-950/40 px-3 text-left text-sm font-medium text-emerald-100 hover:bg-emerald-900/45"
        >
          <Plus size={16} />
          <span>Novo conceito</span>
          <Kbd>Ctrl + K</Kbd>
        </button>
        <button
          type="button"
          onClick={open ? onCloseDraft : onOpenBlank}
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
          title={open ? "Fechar rascunho" : "Mais opcoes"}
          aria-label={open ? "Fechar rascunho" : "Mais opcoes"}
        >
          {open ? <X size={15} /> : <MoreVertical size={15} />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenBlank}
          className="inline-flex h-8 min-w-0 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:border-zinc-700"
        >
          <FileText size={13} />
          <span className="truncate">Na pagina atual</span>
          <Kbd>Ctrl + P</Kbd>
        </button>
        <button
          type="button"
          onClick={onOpenFromSelection}
          disabled={!hasPendingSelection}
          className="inline-flex h-8 min-w-0 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <MousePointer2 size={13} />
          <span className="truncate">A partir da selecao</span>
          <Kbd>Ctrl + Shift + P</Kbd>
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-sm border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              ref={inputRef}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selection ? "Nome do Key Concept" : "Novo Key Concept"}
              className="h-9 min-w-0 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
              aria-label="Novo key concept"
            />
            {title.trim() && (
              <button
                type="button"
                disabled={!valid}
                onClick={onSubmit}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-emerald-900 bg-emerald-950/60 text-emerald-200 hover:border-emerald-700 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                title="Salvar key concept"
                aria-label="Salvar key concept"
              >
                <Save size={16} />
              </button>
            )}
          </div>

          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="Nota opcional"
            className="w-full resize-none rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
          />

          {selection?.text && (
            <div className="rounded-sm border border-emerald-900/50 bg-emerald-950/20 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-emerald-200">Highlight p. {selection.page}</span>
                <button
                  type="button"
                  onClick={onRemoveSelection}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  aria-label="Remover selecao"
                >
                  <X size={13} />
                </button>
              </div>
              <blockquote className="max-h-20 overflow-y-auto border-l border-emerald-700 pl-3 text-xs leading-relaxed text-zinc-400">
                {selection.text}
              </blockquote>
            </div>
          )}

          {duplicateTitle && (
            <div className="text-xs text-amber-300">Ja existe um Key Concept com esse nome.</div>
          )}

          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Destino: p. {page}</span>
            {selection ? <span>highlight sera salvo no PDF</span> : <span>sem highlight vinculado</span>}
          </div>

          {concepts.length > 0 && (
            <ConceptLinkPicker
              concepts={concepts}
              selectedIds={pendingLinkedIds}
              title="Linkar ao criar"
              onToggle={onTogglePendingLink}
            />
          )}
        </div>
      )}
    </section>
  );
}
