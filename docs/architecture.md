# Architecture

Lyceum is split into an Electron main process and a React renderer.

New code follows the modular-monolith decision in
[`docs/adr/001-modular-monolith.md`](adr/001-modular-monolith.md). The legacy
entry points are being migrated by vertical slice; `src/core` is
framework-independent, `src/features` owns application behavior, and Electron
integrations implement explicit ports under `electron/infrastructure`.

## Runtime Shape

```text
React renderer
  |
  | window.api
  v
Preload script
  |
  | ipcRenderer.invoke / ipcRenderer.on
  v
Electron main process
  |
  | local services
  v
SQLite, filesystem, thumbnails, file watcher, backups
```

## Main Process

Key files:

- `electron/main.ts`
- `electron/preload.ts`
- `electron/local-database.ts`
- `electron/infrastructure/sqlite-schema.ts`
- `electron/infrastructure/sqlite-document-query.ts`
- `electron/infrastructure/sqlite-document-search-index.ts`
- `electron/backup.ts`
- `electron/dictionary-manager.ts`

The main process registers IPC handlers for document operations, library management, reader state, categories, habits, backup, dictionary lookup, and native window controls.
The document-query adapter owns library filtering, FTS search, sorting, folder
counts, pagination, identity lookups, and legacy status queries. A separate adapter maintains the FTS index as document
metadata changes; `local-database.ts` retains compatibility exports while
other database responsibilities are migrated. Window-control IPC is registered
by `electron/handlers/windows.handler.ts`, with window creation injected by the
main process.
User-editable document metadata follows a domain repository contract and a
SQLite adapter, including the search-index refresh after title/author changes.
Document file identity, location, lifecycle status, and removal follow a
separate repository contract; both adapters are composed after SQLite startup.
Reader position and reading-status transitions use a format-independent
repository with SQLite as the desktop adapter.
File-open dialogs are registered by `electron/handlers/file-dialogs.handler.ts`;
file processing and the native dialog are injected, keeping IPC orchestration
testable without starting Electron.
Habits and categories use SQLite repository instances created after database
startup and injected into their IPC handlers and backup. Compatibility exports
in `local-database.ts` delegate to the categories repository; the adapters no
longer depend on the legacy database facade.
Backup IPC receives document snapshots through an injected data source; its
handler no longer imports the database facade at runtime.
EPUB vocabulary counts use a dedicated word-index repository while the public
database functions remain as compatibility delegates.
Watch/source folder configuration and unsynced-folder queries likewise use an
isolated SQLite repository behind the compatibility facade.

SQLite schema creation is isolated from database startup. The startup sequence is
bootstrap schema, bootstrap migration, application schema, remaining versioned
migrations, and post-migration schema. This order is covered with an in-memory
database test and must remain stable for existing installations.

Important responsibilities:

- Initialize local SQLite.
- Ensure the managed `library` folder exists in Electron user data.
- Watch the library folder with Chokidar.
- Process PDF and EPUB files.
- Generate and cache thumbnails.
- Move, copy, rename, and delete local documents.
- Bridge local data to the renderer through IPC.

## Renderer

Key areas:

- `src/App.tsx`: route shell, title bar, sidebar, auto-hide behavior, auth bootstrap, backup bootstrap.
- `src/pages/Library/`: local library UI and document management.
- `src/features/library/model/`: framework-independent library view rules.
- The library display projection (special folders, variant grouping, and cache
  reuse) lives in that model and is covered without rendering the page.
- `src/pages/ReadingPage/`: PDF and EPUB readers, tabs, persistence, session tools.
- `src/pages/DashboardPage/`: statistics and visualizations.
- `src/pages/AddReadingPage.tsx`: manual reading entries and book history tools.

The renderer should not access Node APIs directly. All native behavior should go through `window.api`.
Feature modules must not import page components; pages compose feature behavior,
not the reverse. The architecture check enforces this dependency direction.
Infrastructure adapters may not import the database facade, Electron entry
point, or IPC handlers; the architecture check also rejects duplicate IPC
registrations.

## Tabs and Reading

Document tabs are managed by `src/contexts/TabContext.tsx`.

The tab context:

- Persists open tabs in localStorage.
- Rehydrates files by hash through Electron.
- Avoids opening duplicate tabs for the same document.
- Supports tab reordering and detached windows.

## Local Library

The library has two concepts:

- Synced documents: files inside the managed Electron `library` folder.
- Unsynced documents: known files outside the managed library.

Moving or copying an unsynced document into a library folder should call the sync IPC path, not only move the file path, because sync status and category metadata must also be updated.

## Error Handling

The app generally returns `{ success, error }` objects across IPC boundaries. Renderer code is responsible for showing actionable toasts and refreshing local state after successful native operations.
