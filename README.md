# Lyceum (Beta)

<p align="center">
  <img src="public/logo.svg" alt="Lyceum logo" width="76" />
</p>

<h3 align="center">A smarter home for every book you read</h3>

<p align="center">
  <a href="https://github.com/Higino-Neto/Lyceum/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/Higino-Neto/Lyceum?style=for-the-badge">&nbsp</a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge">&nbsp</a>
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0969da?style=for-the-badge">
  <a href="https://github.com/Higino-Neto/Lyceum/stargazers">&nbsp<img alt="GitHub stars" src="https://img.shields.io/github/stars/Higino-Neto/Lyceum?style=for-the-badge"></a>
</p>

<picture>
  <img alt="Lyceum library showing book covers, folders, search, progress, and metadata" src="public/images/lyceum-library-with-preview-v1.png">
</picture>

---

## What is Lyceum?

Lyceum is a desktop app that manages your ebook library, reads PDF and EPUB files, tracks your progress, converts formats, and sends books to your portable E-Reader. It turns a loose folder of documents into a living reading workspace with covers, metadata, folders, notes, statistics, and local-first conversion tools.

It is built for readers who want one place to collect, read, understand, convert, and move their books without bouncing between a file manager, a reader, a stats spreadsheet, and a portable E-Reader transfer tool.

---
## Download

<p>
  <a href="https://github.com/Higino-Neto/Lyceum/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/badge/Windows-.exe%20%2F%20NSIS-0078d4?style=for-the-badge">&nbsp&nbsp&nbsp</a>
  <a href="https://github.com/Higino-Neto/Lyceum/releases/latest"><img alt="Download for macOS" src="https://img.shields.io/badge/macOS-.dmg-000000?style=for-the-badge">&nbsp&nbsp&nbsp</a>
  <a href="https://github.com/Higino-Neto/Lyceum/releases/latest"><img alt="Download for Linux" src="https://img.shields.io/badge/Linux-.AppImage-fcc624?style=for-the-badge">&nbsp&nbsp&nbsp</a>
</p>

<img alt="Full workflow — import EPUB, read, convert to AZW3, send to Kindle" src="public/images/lyceum-flow-v1.gif" width="100%">

---
## Your Library, Evolved

Your library is the center of Lyceum. Import PDFs, EPUBs, CBZ files, TXT documents, and HTML books, then keep them organized with real folders, collections, covers, and rich metadata.

<!-- <picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/library-v1.png">
  <source media="(prefers-color-scheme: light)" srcset="public/library-v1.png">
  <img alt="Lyceum library grid with book covers and folder navigation" src="public/library-v1.png">
</picture> -->

- Browse books as a cover grid with visible thumbnails and metadata.
- Create, rename, move, and delete real folders inside the managed library.
- Edit title, author, series, publisher, ISBN, language, description, notes, and cover data.
- Search across your library and filter by format, date, and sync status.
- Detect documents that live outside the managed library and move or copy them in when you are ready.
- Source folder your already defined library in disc.

> [Image: book metadata editor showing title, author, series, publisher, ISBN, language, description, tags, cover, notes, favorite, and rating]

<picture>
  <img alt="Lyceum library showing book covers, folders, search, progress, and metadata" src="public/images/lyceum-library-folder-tree-v2.png">
</picture>

- **Real folder hierarchy** — Create, rename, move, and delete folders directly inside the library.
- **Source folders** — Link existing directories from anywhere on your disk. Lyceum watches them without duplicating files, so your original folder structure stays untouched.
- **Drag-and-drop** — Move books between folders by dragging. Works with nested folders and subfolder trees.

---
## Smart Reader

Open multiple books at once, switch between them like browser tabs, and come back exactly where you stopped.

- Read PDF and EPUB files inside the app, without losing the library context.
- Keep multiple documents open in persistent tabs.
- Restore page, zoom, scroll, chapter position, and reader state after restart.
- Use focus-friendly reading surfaces for long sessions.
- Navigate EPUB chapters and table-of-contents entries directly.

> [Image: reader with a PDF tab and an EPUB tab open side by side in the tab bar]

<picture>
  <img alt="Lyceum reader showing the epub reader" src="public/images/lyceum-reader-epub-v1.png">
</picture>
<picture>
  <img alt="Lyceum reader showing the epub reader" src="public/images/lyceum-reader-topbar-v1.png">
</picture>

<picture>
  <img alt="Lyceum reader showing the epub reader translation" src="public/images/lyceum-reader-epub-pdf-v2.png">
</picture>

---
## Know Your Reading

Lyceum turns reading into visible momentum. Reading sessions become dashboards, streaks, charts, and rankings that make your progress easier to understand.

![Reading dashboard](public/dashboard-v3.png)

<picture>
  <img alt="Lyceum reader showing the epub reader translation" src="public/images/lyceum-dashboard-charts-v1.png">
</picture>

- See GitHub-style heatmaps for reading consistency.
- Track current streaks, pages read, time spent, books finished, and weekly pace.
- Review charts for pages per day, time per week, and books per month.
- Sync account-level reading statistics with Supabase when configured.
- Compare rankings when cloud reading data is enabled.

---
## Break Free from Formats

Lyceum helps your books move where you need them. Convert locally between common reading formats without installing Calibre, Pandoc, ebook-convert, or kindlegen.

<picture>
  <img alt="Lyceum reader showing the epub reader translation" src="public/images/lyceum-conversion-v1.png">
</picture>

- Import EPUB, PDF, CBZ, TXT, HTML, AZW3, and KFX into the library.
- Convert all formats to all formats with Lyceum's local pipeline.
- Generate KFX when Kindle Previewer is configured for that optional route.
- Keep files on your machine during conversion.
- Review conversion results and warnings instead of guessing what happened.


---
## Send to Kindle

Connect a Kindle, choose books from the library, and let Lyceum prepare the right files for sideloading.

<picture>
  <img alt="Lyceum reader showing the epub reader translation" src="public/images/lyceum-send-to-kindle-v1.png">
</picture>

- Detect Kindle devices through USB storage or Windows MTP.
- Convert EPUB, PDF, TXT, HTML, and CBZ to KFX, AZW3, or MOBI before transfer when needed.
- Organize output filenames by title and author.
- Avoid unsupported direct transfers by guiding books through the conversion path.
- This feature works better with latest versions of kindle.

---
## Built-in Dictionary

Stay in the flow when a word interrupts you. Lyceum can look up words inside the reader, use local dictionary packages, and help you build vocabulary from the books you already own.

<picture>
  <img alt="Lyceum reader showing the epub reader translation" src="public/images/lyceum-reader-epub-translation-v2.png">
</picture>

- Select a word in an EPUB and open definitions without leaving the reader.
- Use downloaded bilingual dictionary packages for offline lookup.
- Extract vocabulary signals from EPUB text for deeper study.

---
## Under the Hood

Lyceum uses a practical desktop stack: Electron for native APIs, React and TypeScript for the interface, Tailwind for styling, SQLite for local library state, Supabase for optional cloud reading data, PDF.js and EPUB tooling for readers, sharp for thumbnails and image processing, and Vitest for tests.


---
## Documentation

The full documentation lives in [docs](docs/index.md), including architecture, local data, sync behavior, development, and releases.

---
## License

MIT. See [LICENSE](LICENSE).

---
## Author

Higino Neto - [@Higino-Neto](https://github.com/Higino-Neto)
