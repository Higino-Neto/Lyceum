import { useMemo, useState } from "react";
import type { LibrarySummary } from "../../../../types/StatsTypes";
import { viz } from "./chartTheme";

type Graph = LibrarySummary["conceptGraph"];

interface PositionedNode {
  id: string;
  title: string;
  bookTitle: string;
  colorIndex: number;
  radius: number;
  x: number;
  y: number;
}

/** Deterministic force layout (no randomness) so the map is stable between renders. */
function layout(graph: Graph, books: string[]): PositionedNode[] {
  const count = graph.nodes.length;
  const nodes = graph.nodes.map((node, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const ring = 30 + (index % 3) * 8;
    return {
      id: node.id,
      title: node.title,
      bookTitle: node.bookTitle,
      colorIndex: Math.max(0, books.indexOf(node.bookId)),
      radius: 1.6 + Math.min(3, Math.sqrt(node.degree)),
      x: 50 + Math.cos(angle) * ring,
      y: 50 + Math.sin(angle) * ring,
      vx: 0,
      vy: 0,
    };
  });
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const edges = graph.edges
    .map((edge) => [indexById.get(edge.source), indexById.get(edge.target)] as const)
    .filter((edge): edge is readonly [number, number] => edge[0] !== undefined && edge[1] !== undefined);
  for (let step = 0; step < 220; step += 1) {
    const cooling = 1 - step / 220;
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const first = nodes[a]!;
        const second = nodes[b]!;
        const dx = first.x - second.x || 0.01;
        const dy = first.y - second.y || 0.01;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = 18 / (distance * distance);
        first.vx += (dx / distance) * force;
        first.vy += (dy / distance) * force;
        second.vx -= (dx / distance) * force;
        second.vy -= (dy / distance) * force;
      }
    }
    for (const [a, b] of edges) {
      const first = nodes[a]!;
      const second = nodes[b]!;
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 12) * 0.02;
      first.vx += (dx / distance) * force;
      first.vy += (dy / distance) * force;
      second.vx -= (dx / distance) * force;
      second.vy -= (dy / distance) * force;
    }
    for (const node of nodes) {
      node.vx += (50 - node.x) * 0.004;
      node.vy += (50 - node.y) * 0.004;
      node.x = Math.max(6, Math.min(94, node.x + node.vx * cooling));
      node.y = Math.max(6, Math.min(92, node.y + node.vy * cooling));
      node.vx *= 0.6;
      node.vy *= 0.6;
    }
  }
  return nodes.map(({ vx: _vx, vy: _vy, ...node }) => node);
}

export default function ConceptMap({ graph, books }: { graph: Graph; books: string[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => layout(graph, books), [graph, books]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const neighbours = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    for (const edge of graph.edges) {
      if (edge.source === hover) set.add(edge.target);
      if (edge.target === hover) set.add(edge.source);
    }
    return set;
  }, [graph.edges, hover]);
  const hovered = hover ? byId.get(hover) : null;

  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="h-72 w-full" preserveAspectRatio="xMidYMid meet">
        {graph.edges.map((edge, index) => {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          if (!source || !target) return null;
          const active = !hover || edge.source === hover || edge.target === hover;
          return (
            <line
              key={index}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="var(--border-strong)"
              strokeWidth={active && hover ? 0.6 : 0.3}
              strokeDasharray={edge.kind === "shared" ? "1 1" : undefined}
              opacity={active ? 1 : 0.2}
            />
          );
        })}
        {nodes.map((node) => (
          <g
            key={node.id}
            onMouseEnter={() => setHover(node.id)}
            onMouseLeave={() => setHover(null)}
            opacity={!neighbours || neighbours.has(node.id) ? 1 : 0.25}
            className="cursor-default"
          >
            <circle cx={node.x} cy={node.y} r={node.radius} fill={viz(node.colorIndex + 1)} stroke="var(--surface)" strokeWidth={0.5} />
            {(node.radius > 2.6 || neighbours?.has(node.id)) && (
              <text x={node.x} y={node.y + node.radius + 3.2} textAnchor="middle" fontSize={2.8} fill="var(--foreground-muted)">
                {node.title.length > 22 ? `${node.title.slice(0, 21)}…` : node.title}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[60%] rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs shadow-lg shadow-shadow">
          <div className="truncate font-medium text-foreground">{hovered.title}</div>
          <div className="truncate text-foreground-subtle">{hovered.bookTitle}</div>
        </div>
      )}
    </div>
  );
}
