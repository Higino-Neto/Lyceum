import { ChevronDown, ChevronRight } from "lucide-react";
import type { KeyConcept } from "../../../../../types/AnnotationTypes";
import AnnotationEmptyState from "./AnnotationEmptyState";
import { conceptAccent } from "./annotationPanelUtils";

interface CurrentPageConceptsProps {
  concepts: KeyConcept[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectConcept: (id: string) => void;
}

export default function CurrentPageConcepts({
  concepts,
  collapsed,
  onToggleCollapsed,
  onSelectConcept,
}: CurrentPageConceptsProps) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-zinc-200"
      >
        <span>Conceitos nesta pagina</span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      {!collapsed && (
        concepts.length === 0 ? (
          <AnnotationEmptyState>Nenhum Key Concept nesta pagina.</AnnotationEmptyState>
        ) : (
          <div className="space-y-1.5">
            {concepts.map((concept, index) => (
              <button
                key={concept.id}
                type="button"
                onClick={() => onSelectConcept(concept.id)}
                className="grid w-full grid-cols-[14px_1fr_16px] items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/70 px-2.5 py-2 text-left hover:border-zinc-700"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: conceptAccent(index) }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-zinc-100">{concept.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                    {concept.excerpt || concept.note || "Sem nota adicional"}
                  </span>
                </span>
                <ChevronRight size={14} className="text-zinc-500" />
              </button>
            ))}
          </div>
        )
      )}
    </section>
  );
}
