# Data and Sync

Lyceum uses local SQLite and Supabase together.

## Local SQLite

Local data lives in Electron user data and is accessed from `electron/local-database.ts`.

Local records include:

- Documents
- File paths and hashes
- Current page, zoom, and scroll
- Thumbnails
- Metadata
- Favorite state
- Rating and notes
- Local categories
- Habits
- Word indexes and vocabulary data

SQLite lets the library and reader work quickly and mostly offline.

## Supabase

Supabase stores account-level and shared data:

- User profiles
- Reading entries
- Books
- Categories
- Reading stats
- Ranking data

Renderer API helpers live in `src/api/database.ts`.

## Reading Entry Flow

1. The user records a reading session.
2. The renderer calls Supabase helpers.
3. Supabase functions insert or update reading rows.
4. Query caches are invalidated.
5. Dashboard cards and charts refetch updated stats.

## Document Sync Flow

For an unsynced local document:

1. The renderer asks for a move or copy into a target library folder.
2. Electron resolves the target path under the managed library root.
3. Electron moves or copies the file.
4. Electron updates the local document path.
5. Electron marks the document as synced and stores the folder/category.
6. The renderer refreshes the library.

## Safety Rules

Filesystem operations should:

- Resolve paths under the managed library root when targeting library folders.
- Reject absolute or unsafe relative target paths.
- Avoid overwriting existing files without explicit behavior.
- Return structured errors to the renderer.

## Backups

Backup handlers in Electron can send local documents, habits, and categories to Supabase after a valid Supabase session is registered with the main process.


## Device Sync

Signed-in devices exchange books and vocabulary through the private Supabase Storage bucket `device-sync` (migration `019_device_sync_storage.sql`). Each user only sees their own folder, `<uid>/`.

- **Send to my devices.** On desktop, select books in the library and press "Devices". On the phone, open a book's details and choose "Send to my devices". The file is uploaded to `<uid>/books/`, and the object name encodes the original file name, the sending platform and the device. Every other device checks this folder on start, on focus and every minute, imports the books it can open, and then deletes the object. Desktop writes received books into the library folder and the folder watcher processes them; mobile runs them through the normal import. Duplicates, matched by SHA-256, are skipped. Only EPUB and PDF can be sent, because those are the formats both platforms open.
- **Vocabulary.** `<uid>/learning/vocabulary.json` holds a `lyceum.learning-backup` snapshot. Each sync downloads the snapshot and merges it locally with the newest-`updatedAt`-wins import. It then uploads the merged result, but only when the result differs from the snapshot. Vocabulary syncs on start, every three minutes, when the app goes to the background, and from "Sync now".
- **Known limitation.** Deleting an annotation, a form override or a review item is not propagated yet, so another device may bring it back. Deletions need tombstones, which are planned.

Code: `src/features/device-sync/`. Desktop file access goes through the `device-sync:read-book` and `device-sync:save-book` IPC channels.
