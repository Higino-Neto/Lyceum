import { useEffect, useMemo, useRef } from "react";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import { buildConceptGraphModel } from "./graphModel";

interface SigmaConceptGraphProps {
  concepts: KeyConcept[];
  relations: ConceptRelation[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string) => void;
}

export default function SigmaConceptGraph({
  concepts,
  relations,
  selectedConceptId,
  onSelectConcept,
}: SigmaConceptGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const model = useMemo(
    () => buildConceptGraphModel(concepts, relations),
    [concepts, relations],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || model.nodes.length === 0) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void Promise.all([
      import("graphology"),
      import("sigma"),
      import("graphology-layout-forceatlas2"),
    ]).then(([graphologyModule, sigmaModule, forceAtlasModule]) => {
      if (cancelled || !containerRef.current) {
        return;
      }

      const Graph = graphologyModule.default;
      const Sigma = sigmaModule.default;
      const forceAtlas2 = forceAtlasModule.default;
      const graph = new Graph({ type: "undirected", multi: false });
      const radius = Math.max(1, model.nodes.length);

      model.nodes.forEach((node, index) => {
        const angle = (Math.PI * 2 * index) / radius - Math.PI / 2;
        const selected = node.id === selectedConceptId;
        graph.addNode(node.id, {
          label: node.label,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: selected ? node.size + 3 : node.size,
          color: selected ? "#a7f3d0" : node.color,
          highlighted: selected,
        });
      });

      model.edges.forEach((edge) => {
        graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
          size: 1.2,
          color: "#3f3f46",
        });
      });

      if (graph.order > 1) {
        const inferred = forceAtlas2.inferSettings(graph);
        forceAtlas2.assign(graph, {
          iterations: Math.min(180, Math.max(70, graph.order * 18)),
          settings: {
            ...inferred,
            gravity: 1.6,
            scalingRatio: 12,
            slowDown: 1.6,
          },
        });
      }

      const renderer = new Sigma(graph, containerRef.current, {
        allowInvalidContainer: true,
        defaultEdgeColor: "#3f3f46",
        defaultNodeColor: "#22c55e",
        labelColor: { color: "#e4e4e7" },
        labelDensity: 0.12,
        labelRenderedSizeThreshold: 7,
        renderEdgeLabels: false,
        zIndex: true,
      });

      renderer.on("clickNode", ({ node }) => onSelectConcept(node));
      cleanup = () => {
        renderer.kill();
        graph.clear();
      };
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn("[KeyConceptGraph] Failed to load Sigma graph renderer:", error);
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [model, onSelectConcept, selectedConceptId]);

  if (model.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center border border-zinc-800 bg-zinc-950/60 px-6 text-center text-sm text-zinc-500">
        Crie Key Concepts para formar o graph deste livro.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full min-h-[420px] w-full bg-zinc-950" />
  );
}
