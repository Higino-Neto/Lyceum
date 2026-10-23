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
    dot: "bg-foreground-muted",
    text: "text-foreground",
    border: "border-border-strong",
    bg: "bg-surface",
  },
  reading: {
    labelKey: "atlas:status.reading.label",
    detailKey: "atlas:status.reading.detail",
    dot: "bg-info",
    text: "text-info",
    border: "border-info/40",
    bg: "bg-info-muted",
  },
  paused: {
    labelKey: "atlas:status.paused.label",
    detailKey: "atlas:status.paused.detail",
    dot: "bg-warning",
    text: "text-warning",
    border: "border-warning/40",
    bg: "bg-warning-muted",
  },
  read: {
    labelKey: "atlas:status.read.label",
    detailKey: "atlas:status.read.detail",
    dot: "bg-primary",
    text: "text-primary",
    border: "border-primary/40",
    bg: "bg-primary-muted",
  },
  not_a_book: {
    labelKey: "reading:status.notABook",
    detailKey: "reading:status.notABook",
    dot: "bg-foreground-subtle",
    text: "text-foreground-muted",
    border: "border-border-strong",
    bg: "bg-surface",
  },
  unknown: {
    labelKey: "reading:status.unknown",
    detailKey: "reading:status.unknown",
    dot: "bg-border-strong",
    text: "text-foreground-muted",
    border: "border-border-strong",
    bg: "bg-surface",
  },
};

const STATUS_EMPTY_KEYS: Record<ReadingStatus, TranslationKey> = {
  want_to_read: "atlas:status.empty.want_to_read",
  reading: "atlas:status.empty.reading",
  paused: "atlas:status.empty.paused",
  read: "atlas:status.empty.read",
  not_a_book: "reading:status.notABook",
  unknown: "reading:status.unknown",
};

export function statusLabel(status: ReadingStatus): string {
  return getReadingStatusLabel(status);
}

export function emptyMessage(status: ReadingStatus): string {
  return translate(STATUS_EMPTY_KEYS[status]);
}
