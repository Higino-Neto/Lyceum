# Library and Reader

## Library

The Library page manages local PDF and EPUB documents.

Main files:

- `src/pages/Library/Library.tsx`
- `src/pages/Library/useBooks.ts`
- `src/pages/Library/components/FolderTree.tsx`
- `src/pages/Library/components/BookGrid/`
- `electron/main.ts`

## Synced and Unsynced Documents

Synced documents live inside the managed library folder:

```text
<electron userData>/library
```

Unsynced documents are known to Lyceum but still live elsewhere on disk. They can be moved or copied into a selected library folder.

Expected behavior:

- Move: the original file is moved into the selected library folder.
- Copy: the file is copied into the selected library folder and the Lyceum record points at the managed copy.
- Drag and drop to a folder: unsynced files are moved into that folder and marked as synced.

## Folders

Folders are real directories under the managed library path. Folder operations are handled by Electron to avoid unsafe renderer filesystem access.

Folder actions:

- Create folder
- Rename folder
- Delete folder
- Move folder
- Drop books into folder
- Import books directly into folder

## Book Formats

One book can have several files (EPUB, PDF, AZW3, .lyceum...). They are grouped
only in the database, by a shared `documents.bookId`; files are never moved or
renamed by grouping, and folder names have no special meaning (the old `_Name`
merge folders and `__Name` collection folders are ordinary folders now).

- The card shows one chip per file. Clicking a chip selects only that file.
- Selection always holds concrete files (`selectedFileMap` in `Library.tsx`):
  clicking a card selects all of its files, and every bulk action, Ctrl+C/X/V
  and drag reads the same file list, so no action treats grouped books
  differently.
- Group: select two or more files and choose "Group formats", drop a book onto
  another, or use the Duplicate Finder (`book:merge`).
- Separate one file: the detail panel's "Separate <format>" or the bulk
  "Separate" action (`book:remove-from-group`). "Ungroup all formats" clears
  the whole group (`book:unmerge`). A group left with one file is dissolved.
- Converting a library book attaches the output to the source book
  (`attachConversionOutput` in `electron/main.ts`).
- Reading status and score are shared by the group (`updateReadingStatus`).

Main files: `src/pages/Library/components/BookGrid/FormatChips.tsx`,
`BookGrid/bookFiles.ts`, `src/features/library/model/libraryView.ts`
(`buildDisplayBooks`), `electron/local-database.ts` (`mergeDocuments`).

## List View

The list view is a table whose columns are configurable from the header's
Columns menu (show/hide, reorder, reset); widths are resized by dragging the
header edge. The choice is stored per device in `lyceum_library_listColumns`.
Clicking a sortable header switches the library sort (shared with the sort
dropdown); author, series, rating, format and date-added sorts run in SQL
(`electron/infrastructure/sqlite-document-query.ts`) and again client-side
(`sortBooksForLibraryView`).

- Column model: `src/features/library/model/listColumns.ts`
- UI: `src/pages/Library/components/BookGrid/BookListHeader.tsx`, `BookListItem.tsx`

## Duplicate Finder

The copy-check button in the library toolbar opens
`DuplicateFinderDialog`. Files are exact-deduplicated by SHA-256 already, so
it looks for the same book under different files: same ISBN (ISBN-10 is
normalized to 13), same normalized title with compatible authors, or a very
similar title by the same author (`src/features/library/model/duplicates.ts`).
Each group can be merged as formats of one book (`book:merge`, no file moves),
have selected copies removed (optionally deleting the files), or be dismissed;
dismissed groups come back if their members change.

## Reader

The reader renders PDF and EPUB. Every other library format is opened through
a cached copy built by `electron/services/reader-format-service.ts`:

- MOBI, AZW, AZW3, PRC, DOCX, FB2, TXT, HTML, CBZ and CBR are converted to EPUB
  with the Lyceum pipeline (the same importers the Conversion screen uses) and
  cached in `<userData>/reader-cache/<hash>-v<N>.epub` (most recent 40 kept).
- AZW4 (Print Replica) opens the PDF embedded in the book.
- KFX and DRM-protected books are refused with a translated message.
- CBR needs a system RAR extractor (7-Zip, unrar, unar or bsdtar); CBR files
  that are really ZIPs open without one.

The tab keeps the original file's hash and path, so progress and library
records stay attached to the real book. Bump `READER_CACHE_VERSION` when the
importers change enough that cached copies should be rebuilt.

Main files:

- `src/pages/ReadingPage/ReadingPage.tsx`
- `src/contexts/TabContext.tsx`
- `src/components/tabs/TabBar.tsx`
- `src/components/tabs/TabItem.tsx`
- `src/pages/ReadingPage/components/pdf-reader/`
- `src/pages/ReadingPage/components/epub-reader/`

## Reader State

Reader state is stored locally by file hash. The state includes the current page, zoom, scroll, and annotation payload.

When a tab is restored, the renderer asks Electron to reopen the document by hash. If the file moved, Electron attempts to locate the current file path and returns the recovered path.

## Reader Tabs

Tabs are persisted in localStorage under the Lyceum namespace. They support:

- Open PDF
- Open EPUB
- Close tab
- Reorder tabs
- Detach tab into a new window
- Restore tabs on restart

Tabs should shrink as more documents are opened, similar to a browser, before any overflow behavior is needed.

