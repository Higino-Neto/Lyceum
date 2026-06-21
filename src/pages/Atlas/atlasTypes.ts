import type { ReadingStatus } from "../../types/LibraryTypes";

export type AtlasView = "roadmap" | "status";
export type StatusFilter = "all" | ReadingStatus;

export type DropTarget = {
  sectionId: string;
  index: number;
} | null;

export type StatusDropTarget = {
  status: ReadingStatus;
  index: number;
} | null;

export type AddTarget =
  | { kind: "roadmap"; sectionId: string }
  | { kind: "status"; status: ReadingStatus };

export const ATLAS_BOOKS_QUERY_KEY = ["atlas-books"] as const;
export const ATLAS_MAP_QUERY_KEY = "atlas-reading-map";
export const ATLAS_STATUS_QUERY_KEY = ["atlas-status-items"] as const;

export const STATUS_VISUAL: Record<ReadingStatus, {
  label: string;
  detail: string;
  dot: string;
  text: string;
  border: string;
  bg: string;
}> = {
  want_to_read: {
    label: "Fila",
    detail: "Reservado",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
    border: "border-zinc-700",
    bg: "bg-zinc-900",
  },
  reading: {
    label: "Lendo",
    detail: "Leitura ativa",
    dot: "bg-sky-400",
    text: "text-sky-300",
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
  },
  paused: {
    label: "Pausado",
    detail: "Em espera",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  read: {
    label: "Concluido",
    detail: "Fechado",
    dot: "bg-green-400",
    text: "text-green-300",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
};

export function statusLabel(status: ReadingStatus): string {
  return STATUS_VISUAL[status].label;
}

export function emptyMessage(status: ReadingStatus): string {
  if (status === "want_to_read") return "Nenhum livro na fila.";
  if (status === "reading") return "Nenhuma leitura em andamento.";
  if (status === "paused") return "Nenhum livro pausado.";
  return "Nenhum livro concluido.";
}
