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
- `electron/backup.ts`
- `electron/dictionary-manager.ts`

The main process registers IPC handlers for document operations, library management, reader state, categories, habits, backup, dictionary lookup, and native window controls.

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
- `src/pages/ReadingPage/`: PDF and EPUB readers, tabs, persistence, session tools.
- `src/pages/DashboardPage/`: statistics and visualizations.
- `src/pages/AddReadingPage.tsx`: manual reading entries and book history tools.

The renderer should not access Node APIs directly. All native behavior should go through `window.api`.
Feature modules must not import page components; pages compose feature behavior,
not the reverse. The architecture check enforces this dependency direction.

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
