import type { ReadingStatus } from "../../types/LibraryTypes";
import type { TranslationKey } from "../../i18n";
import { getReadingStatusLabel } from "../../lib/readingStatus";
import { translate } from "../../i18n";

export type StatusDropTarget = {
  status: ReadingStatus;
  index: number;
} | null;

export type AddTarget = {
  kind: "status";
  status: ReadingStatus;
};

export const ATLAS_BOOKS_QUERY_KEY = ["atlas-books"] as const;
export const ATLAS_STATUS_QUERY_KEY = ["atlas-status-items"] as const;

export const STATUS_VISUAL: Record<ReadingStatus, {
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  dot: string;
  text: string;
  border: string;
  bg: string;
}> = {
  want_to_read: {
    labelKey: "atlas:status.wantToRead.label",
    detailKey: "atlas:status.wantToRead.detail",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
    border: "border-zinc-700",
    bg: "bg-zinc-900",
  },
  reading: {
    labelKey: "atlas:status.reading.label",
    detailKey: "atlas:status.reading.detail",
    dot: "bg-sky-400",
    text: "text-sky-300",
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
  },
  paused: {
    labelKey: "atlas:status.paused.label",
    detailKey: "atlas:status.paused.detail",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  read: {
    labelKey: "atlas:status.read.label",
    detailKey: "atlas:status.read.detail",
    dot: "bg-green-400",
    text: "text-green-300",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
};

const STATUS_EMPTY_KEYS: Record<ReadingStatus, TranslationKey> = {
  want_to_read: "atlas:status.empty.want_to_read",
  reading: "atlas:status.empty.reading",
  paused: "atlas:status.empty.paused",
  read: "atlas:status.empty.read",
};

export function statusLabel(status: ReadingStatus): string {
  return getReadingStatusLabel(status);
}

export function emptyMessage(status: ReadingStatus): string {
  return translate(STATUS_EMPTY_KEYS[status]);
}
