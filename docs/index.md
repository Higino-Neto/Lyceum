# Lyceum Documentation

This documentation explains Lyceum from end to end: product behavior, architecture, local data, cloud sync, development, testing, and releases.

## Contents

- [Architecture](architecture.md)
- [Library and Reader](library-reader.md)
- [Data and Sync](data-and-sync.md)
- [Development Guide](development.md)
- [Release Guide](release.md)

## Product Overview

Lyceum is an Electron desktop app for people who read long-form material and want a durable record of that work. It is organized around four main areas:

- Dashboard: statistics, heatmaps, streaks, charts, and ranking.
- Register Reading: manual reading entries and book-level history.
- Library: local document management for PDF and EPUB files.
- Reader: tabbed embedded reading with persistent document state.

## Core Workflows

1. A user signs in with Supabase Auth.
2. The user imports, opens, or discovers local PDF and EPUB documents.
3. Documents are stored in local SQLite with metadata, thumbnails, reader state, and sync status.
4. The reader opens documents in tabs and restores state when possible.
5. Reading sessions can be registered and synchronized to Supabase.
6. Dashboard and ranking views aggregate reading entries.

## Repository Map

```text
electron/      Native desktop services, IPC, SQLite, file watcher, backup, packaging entry
src/           React renderer application
public/        Static assets and screenshots
docs/          GitHub Pages documentation
scripts/       Project scripts
.github/       Release and docs workflows
```

## Local Desktop Responsibilities

Electron owns the things the browser cannot do safely:

- Open native file dialogs.
- Watch the managed library folder.
- Read and move local files.
- Generate thumbnails.
- Persist local state in SQLite.
- Handle app windows, file associations, and updates.

The React renderer owns user interaction and calls Electron through `window.api`, exposed by the preload script.

## Cloud Responsibilities

Supabase owns authenticated, cross-device data:

- Profiles
- Reading entries
- Categories
- Book records
- Reading stats and ranking data

Local library documents can exist without cloud sync. Reading statistics require a signed-in user and configured Supabase environment variables.

## Publishing Documentation

The repository includes `.github/workflows/docs.yml`, which publishes this `docs/` directory to GitHub Pages. In GitHub:

1. Open repository Settings.
2. Go to Pages.
3. Set Source to GitHub Actions.
4. Push documentation changes to `main`.

