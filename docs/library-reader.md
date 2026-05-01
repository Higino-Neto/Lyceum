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

## Reader

The reader supports PDF and EPUB tabs.

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

