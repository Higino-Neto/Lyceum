import { Ban, BookmarkCheck, BookOpen, CheckCircle, CircleHelp, PauseCircle, type LucideIcon } from "lucide-react";
import type { BookWithThumbnail, ReadingStatus } from "../../../../types/LibraryTypes";
import {
  getEffectiveReadingStatus,
  getGroupRating,
  getGroupReadingStatus,
  isMergedGroup,
} from "../../../../lib/readingStatus";

/**
 * Merged variants behave as one book: the library shows one shared status and
 * score instead of whichever variant happens to be the representative.
 */
export function getDisplayReadingStatus(book: BookWithThumbnail): ReadingStatus {
  return isMergedGroup(book) ? getGroupReadingStatus(book) : getEffectiveReadingStatus(book);
}

export function getDisplayRating(book: BookWithThumbnail): number {
  return isMergedGroup(book) ? getGroupRating(book) : Math.max(0, Number(book.rating) || 0);
}

export function getReadingStatusIcon(status: ReadingStatus): { Icon: LucideIcon; color: string } | null {
  switch (status) {
    case "reading":
      return { Icon: BookOpen, color: "text-primary" };
    case "want_to_read":
      return { Icon: BookmarkCheck, color: "text-warning" };
    case "read":
      return { Icon: CheckCircle, color: "text-primary" };
    case "paused":
      return { Icon: PauseCircle, color: "text-warning" };
    case "not_a_book":
      return { Icon: Ban, color: "text-foreground-subtle" };
    case "unknown":
      return { Icon: CircleHelp, color: "text-foreground-subtle" };
    default:
      return null;
  }
}
