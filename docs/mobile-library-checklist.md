# Lyceum Mobile Library Checklist

This checklist tracks the mobile adaptation of the desktop library. Mobile keeps
the same user concepts while using app-managed storage and explicit folder
imports instead of unrestricted desktop filesystem access.

## MVP library workflow

- [x] Start with an honest empty library, without demo books or fake counts.
- [x] Import PDF, EPUB, and TXT into app-managed storage.
- [x] Import a source folder snapshot while preserving its folder hierarchy.
- [x] Re-import a source folder to discover new or changed books.
- [x] Search title, author, filename, category, notes, folder, and source folder.
- [x] Filter by file type, favorite state, folder, and source folder.
- [x] Sort by title, recent activity, progress, size, and import date.
- [x] Switch between grid and list layouts.
- [x] Create, rename, and delete managed folders.
- [x] Move one or many books between managed folders.
- [x] Edit title, author, category, notes, description, ISBN, publisher, date,
      rating, and favorite state.
- [x] Delete library records and their app-managed files safely.
- [x] Detect likely duplicate imports by filename and file size.
- [x] Show real recent-reading and favorite surfaces.
- [x] Persist PDF page, EPUB CFI/progress, and TXT scroll position.
- [x] Record page-aware or progress-aware reading sessions.
- [x] Preserve the library and reader state after restart and OTA updates.

## Mobile filesystem adaptation

- [x] Store managed documents under the Capacitor app data directory.
- [x] Keep metadata in a schema-versioned repository.
- [x] Migrate the original localStorage MVP state.
- [x] Remove orphaned managed files and thumbnails when a book is deleted.
- [x] Report storage/import failures instead of silently retaining large data
      URLs in metadata.
- [x] Treat source folders as explicit user-selected snapshots on Android/iOS.
- [x] Add Android Storage Access Framework bookmarks for persistent external
      folder rescans.
- [ ] Add iOS security-scoped folder bookmarks where platform support allows it.

## Desktop features intentionally adapted

- [x] Replace desktop synced/unsynced with Managed and Source Folder views.
- [x] Preserve folder CRUD and book moves inside the app-managed library.
- [x] Replace desktop folder watching with explicit mobile rescan plus a visible
      last-scan result.
- [x] Keep USB/Kindle sideload and broad filesystem watching desktop-only.
- [x] Keep heavy format conversion desktop-only until a mobile use case exists.

## Quality gate

- [ ] Unit tests cover migration, folders, sorting/filtering, duplicates, moves,
      deletion, and session calculation.
- [ ] Mobile component tests cover empty library, import, editing, and bulk mode.
- [x] `npm run build:mobile` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run cap:sync` passes.
- [x] Desktop `npm run build` still passes.
- [ ] Android `assembleDebug` passes on a machine with Android SDK configured.
- [ ] Manual Android smoke test covers import, folder import, move, resume,
      session, favorite, search, and deletion.
- [ ] Manual iOS smoke test covers the same workflow when Xcode is available.
