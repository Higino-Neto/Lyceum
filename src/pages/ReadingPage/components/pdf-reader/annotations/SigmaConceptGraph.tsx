import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import type Sigma from "sigma";
import type Graph from "graphology";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import { buildConceptGraphModel } from "./graphModel";

interface SigmaConceptGraphProps {
  concepts: KeyConcept[];
  relations: ConceptRelation[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string | null) => void;
}

export default function SigmaConceptGraph({
  concepts,
  relations,
  selectedConceptId,
  onSelectConcept,
}: SigmaConceptGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedIdRef = useRef(selectedConceptId);
  selectedIdRef.current = selectedConceptId;
  const [error, setError] = useState(false);
  const model = useMemo(
    () => buildConceptGraphModel(concepts, relations),
    [concepts, relations],
  );

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !rendererRef.current) return;
    graph.forEachNode((id, attributes) => {
      const selected = id === selectedConceptId;
      graph.mergeNodeAttributes(id, {
        size: selected ? (attributes.baseSize as number) + 3 : attributes.baseSize,
        color: selected ? "#e4e4e7" : attributes.baseColor,
        highlighted: selected,
      });
    });
    rendererRef.current.refresh();
  }, [selectedConceptId]);

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
        const selected = node.id === selectedIdRef.current;
        graph.addNode(node.id, {
          label: node.label,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: selected ? node.size + 3 : node.size,
          color: selected ? "#e4e4e7" : node.color,
          baseSize: node.size,
          baseColor: node.color,
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
        defaultNodeColor: "#a1a1aa",
        labelColor: { color: "#e4e4e7" },
        labelDensity: 0.12,
        labelRenderedSizeThreshold: 7,
        renderEdgeLabels: false,
        zIndex: true,
      });

      graphRef.current = graph;
      rendererRef.current = renderer;
      setError(false);

      renderer.on("clickNode", ({ node }) => onSelectConcept(node));
      renderer.on("clickStage", () => onSelectConcept(null));
      cleanup = () => {
        renderer.kill();
        graph.clear();
        graphRef.current = null;
        rendererRef.current = null;
      };
    }).catch((error) => {
      setError(true);
      if (import.meta.env.DEV) {
        console.warn("[KeyConceptGraph] Failed to load Sigma graph renderer:", error);
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [model, onSelectConcept]);

  if (model.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center border border-zinc-800 bg-zinc-950/60 px-6 text-center text-sm text-zinc-500">
        Crie notas e vínculos para formar o mapa deste livro.
      </div>
    );
  }

  return <div className="relative h-full min-h-0 w-full bg-zinc-950">
    <div ref={containerRef} className="h-full w-full" />
    {error && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-400">Não foi possível abrir o mapa.</div>}
    <div className="absolute bottom-4 left-4 flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900/95 p-1 shadow-lg" aria-label="Controles do mapa">
      <button type="button" onClick={() => rendererRef.current?.getCamera().animatedZoom({ duration: 180 })} className="rounded-md p-2 text-zinc-200 hover:bg-zinc-700" title="Aproximar" aria-label="Aproximar"><Plus size={17} /></button>
      <button type="button" onClick={() => rendererRef.current?.getCamera().animatedUnzoom({ duration: 180 })} className="rounded-md p-2 text-zinc-200 hover:bg-zinc-700" title="Afastar" aria-label="Afastar"><Minus size={17} /></button>
      <button type="button" onClick={() => rendererRef.current?.getCamera().animatedReset({ duration: 180 })} className="rounded-md p-2 text-zinc-200 hover:bg-zinc-700" title="Enquadrar tudo" aria-label="Enquadrar tudo"><Maximize size={17} /></button>
    </div>
  </div>;
}
