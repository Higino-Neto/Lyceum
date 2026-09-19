import type { ReadingStatus } from "../../types/LibraryTypes";

export interface ReadingPosition {
  currentPage: number;
  currentZoom: number;
  currentScroll: number;
  annotations: string;
}

export interface ReaderProgressRepository {
  markOpened(fileHash: string): void;
  savePosition(fileHash: string, position: ReadingPosition): void;
  updateStatus(fileHash: string, status: ReadingStatus): boolean;
}

export function assertReadingStatus(status: ReadingStatus): void {
  if (status !== "want_to_read" && status !== "reading" && status !== "paused" && status !== "read") {
    throw new Error("Invalid reading status");
  }
}
