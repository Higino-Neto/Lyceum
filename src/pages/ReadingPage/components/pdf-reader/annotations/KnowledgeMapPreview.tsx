import { Maximize2, Network } from "lucide-react";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import { buildConceptGraphModel } from "./graphModel";
import { conceptAccent } from "./annotationPanelUtils";

interface KnowledgeMapPreviewProps {
  concepts: KeyConcept[];
  relations: ConceptRelation[];
  onOpenGraph: () => void;
}

export default function KnowledgeMapPreview({
  concepts,
  relations,
  onOpenGraph,
}: KnowledgeMapPreviewProps) {
  const model = buildConceptGraphModel(concepts.slice(0, 6), relations);
  const positions = model.nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, model.nodes.length) - Math.PI / 2;
    const radius = index === 0 ? 18 : 34;
    return {
      ...node,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      color: conceptAccent(index),
    };
  });
  const byId = new Map(positions.map((node) => [node.id, node]));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
        <span className="inline-flex items-center gap-2">
          <Network size={14} />
          Mapa do conhecimento
        </span>
        <button
          type="button"
          onClick={onOpenGraph}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="Abrir graph"
          aria-label="Abrir graph"
        >
          <Maximize2 size={13} />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenGraph}
        className="relative block h-28 w-full overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/70 text-left hover:border-zinc-700"
      >
        {positions.length === 0 ? (
          <span className="flex h-full items-center justify-center px-5 text-center text-xs text-zinc-500">
            Crie conceitos e links para formar o mapa.
          </span>
        ) : (
          <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Preview do mapa de conceitos">
            {model.edges.map((edge) => {
              const source = byId.get(edge.source);
              const target = byId.get(edge.target);
              if (!source || !target) return null;
              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#52525b"
                  strokeWidth="0.8"
                />
              );
            })}
            {positions.map((node) => (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r={node.degree > 0 ? 3.8 : 3.2} fill={node.color} />
                <text x={node.x + 4.5} y={node.y + 1.5} fill="#d4d4d8" fontSize="4" className="select-none">
                  {node.label.slice(0, 18)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </button>
    </section>
  );
}
