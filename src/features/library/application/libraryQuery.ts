import type {
  LibrarySection,
  LibrarySortOption,
} from "../../../types/LibraryTypes";

export interface LibraryQueryInput {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileTypes: readonly string[];
  selectedFolder: string | null;
  includeSubfolders: boolean;
}

export interface BuiltLibraryQuery {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileType: string;
  folderPath: string | null;
  includeSubfolders: boolean;
}

/** Builds the transport query without leaking view-state rules into the page. */
export function buildLibraryQuery(input: LibraryQueryInput): BuiltLibraryQuery {
  return {
    section: input.section,
    search: input.search,
    sort: input.sort,
    fileType: input.fileTypes.length === 0 ? "all" : input.fileTypes.join(","),
    folderPath: input.section === "usb" ? null : input.selectedFolder,
    includeSubfolders: input.includeSubfolders,
  };
}
