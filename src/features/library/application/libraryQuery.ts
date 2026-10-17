import type {
  LibrarySection,
  LibrarySortOption,
} from "../../../types/LibraryTypes";
import { LIBRARY_STATUS_FILTER_VALUES } from "../../../lib/readingStatus";

export interface LibraryQueryInput {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileTypes: readonly string[];
  selectedFolder: string | null;
  includeSubfolders: boolean;
  visibleStatuses?: readonly string[] | null;
}

export interface BuiltLibraryQuery {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileType: string;
  folderPath: string | null;
  includeSubfolders: boolean;
  readingStatuses?: string[] | null;
}

/** Builds the transport query without leaking view-state rules into the page. */
export function buildLibraryQuery(input: LibraryQueryInput): BuiltLibraryQuery {
  // An empty array means everything is hidden; keep it as an empty filter
  // instead of dropping it (which would show all books).
  const readingStatuses = input.visibleStatuses && input.visibleStatuses.length < LIBRARY_STATUS_FILTER_VALUES.length
    ? [...input.visibleStatuses]
    : undefined;
  return {
    section: input.section,
    search: input.search,
    sort: input.sort,
    fileType: input.fileTypes.length === 0 ? "all" : input.fileTypes.join(","),
    folderPath: input.section === "usb" ? null : input.selectedFolder,
    includeSubfolders: input.includeSubfolders,
    readingStatuses,
  };
}
