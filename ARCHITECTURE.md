Comprehensive Analysis of the Lyceum Project
1. Project Description and Purpose
Lyceum (version 1.8.28, Beta) is a cross-platform ebook management and reading application described as "A smarter home for every book you read." It is authored by Higino Neto and licensed under MIT (Copyright 2026).
Core capabilities:
- Library Management: Import, organize, search, and manage ebooks (PDF, EPUB, CBZ, TXT, HTML, AZW3, KFX) in a local library with folders, collections, covers, and rich metadata.
- Built-in Reader: Read PDF and EPUB files directly inside the app with persistent tabs, zoom, scroll, and chapter position restoration.
- Format Conversion: Locally convert between common reading formats (e.g., EPUB to PDF, PDF to EPUB, anything to AZW3) without needing external tools like Calibre or Pandoc.
- Kindle Send: Detect Kindle devices via USB (filesystem or Windows MTP), convert books if needed, and sideload them to Kindle e-readers.
- Reading Statistics: GitHub-style heatmaps, streaks, charts (pages per day, time per week, books per month), and a ranking system.
- Dictionary: In-reader word lookup using local bilingual dictionary packages with offline support.
- Vocabulary Extraction: Extract vocabulary signals from EPUB text for study.
- Annotations & Concept Graph: Key concepts, relations, and a visual knowledge graph (using Sigma/Graphology).
- Habit Tracker: Built-in habit tracking.
- Cloud Sync: Optional Supabase integration for user accounts, reading entries, and backups.
- Mobile: Android mobile app (with iOS scaffolding but excluded from deployment).
2. Tech Stack
Layer	Technology
Language	TypeScript (ES2020 target, "type": "module")
Desktop Framework	Electron 30
UI Framework	React 18
Mobile Framework	Capacitor 8 (Android + iOS scaffolding)
Styling	Tailwind CSS 4 (with @tailwindcss/vite plugin)
Build Tool	Vite 5 (with vite-plugin-electron for Electron integration)
Bundler/Packager	Electron Builder 24
Local Database	SQLite via better-sqlite3
Cloud Backend	Supabase (auth, reading data, backups)
PDF Rendering	PDF.js 4.10.38 (vendored in vendor/pdfjs-4.10.38/)
EPUB Rendering	epub.js 0.3.93
Image Processing	sharp 0.34, @napi-rs/canvas
Charts	Recharts 3.8, D3
Graph Visualization	Sigma 3.0, Graphology 0.26
Animations	Motion (Framer Motion) 12
Rich Text Editor	CodeMirror 6 (Markdown)
File Watching	Chokidar 5
Drag & Drop	@dnd-kit/core + @dnd-kit/sortable
State Management	React Context + TanStack React Query 5
Routing	React Router DOM 7
Testing	Vitest 1.4 + Testing Library (jest-dom, react, user-event)
Linting	ESLint 8 + TypeScript ESLint
Mobile OTA Updates	@capgo/capacitor-updater
Electron Auto-Update	electron-updater
Package Management	npm (with package-lock.json)
Node.js	v20+ required
3. Project Directory Structure
/home/higino-neto/dev/lyceum/
|
|-- .github/workflows/          # CI/CD pipelines
|   |-- main.yml                # Unified Windows + Linux + Android release
|   |-- docs.yml                # GitHub Pages documentation deployment
|
|-- android/                    # Capacitor Android native project
|   |-- app/build.gradle        # Android app build config (SDK versions, signing, dependencies)
|   |-- build.gradle            # Root Gradle config
|   |-- variables.gradle        # Version variables
|   |-- gradle/                 # Gradle wrapper
|
|-- ios/                        # Capacitor iOS native project (scaffolded, not actively deployed)
|   |-- App/                    # Xcode project, assets, splash
|
|-- electron/                   # Electron main process code
|   |-- main.ts                 # Main entry point (~1900 lines, IPC handlers, USB/Kindle, file ops)
|   |-- preload.ts              # Context bridge (exposes `window.api` to renderer)
|   |-- local-database.ts       # SQLite initialization and CRUD
|   |-- backup.ts               # Supabase backup logic
|   |-- database-migrations.ts  # Schema migrations
|   |-- annotation-repository.ts# Annotations/concept storage
|   |-- dictionary-manager.ts   # Dictionary package management
|   |-- dictionary-storage.ts   # Dictionary storage layer
|   |-- lemmatizer.ts           # Word lemmatization
|   |-- lookup-engine.ts        # Dictionary lookup engine
|   |-- handlers/               # IPC handler modules
|   |   |-- books.handler.ts
|   |   |-- library.handler.ts
|   |-- services/               # Business logic services (25 files)
|   |   |-- document-processing.ts
|   |   |-- library-service.ts
|   |   |-- file-service.ts
|   |   |-- folder-service.ts
|   |   |-- update-service.ts
|   |   |-- pdf-page-renderer.ts
|   |   |-- pdfCache.ts
|   |   |-- removable-volumes.ts       # USB device scanning (Linux/macOS/Windows)
|   |   |-- linux-file-clipboard.ts    # Linux clipboard integration
|   |   |-- windows-file-clipboard.ts  # Windows clipboard integration
|   |   |-- vocabulary-service.ts
|   |   |-- desktop-release-resolver.ts
|   |   |-- managed-folder-paths.ts
|   |   |-- book-file-metadata.ts
|   |   |-- ... (and more)
|   |-- workers/                # Background processing workers
|   |   |-- processing.worker.ts
|   |   |-- processingClient.ts
|   |   |-- protocol.ts
|   |   |-- workerPath.ts
|
|-- src/                        # React renderer source
|   |-- main.tsx                # Desktop entry point
|   |-- App.tsx                 # Main app shell (routing, sidebar, auto-hide, backups)
|   |-- index.css               # Global styles
|   |-- vite-env.d.ts
|   |-- api/                    # Supabase API helpers
|   |   |-- database.ts
|   |   |-- bookMetadataSearch.ts
|   |   |-- externalBooks.ts
|   |-- components/             # Reusable UI components
|   |   |-- Sidebar.tsx
|   |   |-- TitleBar.tsx
|   |   |-- auth/               # Auth-related components
|   |   |-- settings/           # Settings dialog
|   |   |-- ui/                 # Generic UI primitives
|   |   |-- tabs/
|   |   |-- skeletons/
|   |-- contexts/               # React contexts
|   |   |-- AuthContext.tsx
|   |   |-- LibraryContext.tsx
|   |   |-- TabContext.tsx
|   |   |-- AppSettingsContext.tsx
|   |   |-- ConversionQueueContext.tsx
|   |-- hooks/                  # Custom React hooks (13 files)
|   |-- lib/                    # Core libraries
|   |   |-- lyceum/             # Format conversion pipeline
|   |   |-- epub-to-pdf/        # EPUB to PDF conversion
|   |   |-- pdf-to-epub/        # PDF to EPUB conversion
|   |   |-- supabase.ts         # Supabase client setup
|   |   |-- readingStatus.ts
|   |-- navigation/
|   |   |-- routes.ts           # Route definitions (Dashboard, Library, Reader, Atlas, etc.)
|   |-- pages/                  # Route pages
|   |   |-- Library/            # Library page
|   |   |-- ReadingPage/        # PDF/EPUB reader
|   |   |-- DashboardPage/      # Statistics dashboard
|   |   |-- Atlas/              # Reading status / concept graph
|   |   |-- Conversion/         # Format conversion dialog
|   |   |-- HabitTrackerPage/   # Habit tracking
|   |   |-- AddReadingPage.tsx
|   |   |-- SignInPage.tsx / SignUpPage.tsx / etc.
|   |-- types/                  # TypeScript type definitions (8 files)
|   |-- utils/                  # Utility functions (6 files)
|   |-- assets/                 # Static assets
|   |-- mobile/                 # Mobile-specific code (49 files)
|   |   |-- main.tsx            # Mobile entry point
|   |   |-- MobileApp.tsx
|   |   |-- MobileLibraryScreen.tsx
|   |   |-- MobileDashboardScreen.tsx
|   |   |-- MobileReadingEntryScreen.tsx
|   |   |-- PdfPane.tsx / EpubPane.tsx / TextPane.tsx
|   |   |-- readerModel.ts / pdfReaderModel.ts
|   |   |-- mobileUpdater.ts / nativeApkUpdater.ts
|   |   |-- storage.ts / supabaseMobile.ts
|   |   |-- ... (49 files total)
|   |-- test/                   # Test suite (80+ test files)
|
|-- scripts/                    # Build and utility scripts
|   |-- prepare-pdfjs.mjs       # PDF.js asset preparation
|   |-- verify-pdfjs-assets.mjs # PDF.js asset verification
|   |-- verify-electron-imports.mjs
|   |-- verify-electron-workers.mjs
|   |-- clean-build.mjs
|   |-- electron-after-pack.cjs # Post-packaging hook (locale pruning, native module verification)
|   |-- size-audit.mjs
|   |-- smoke-pdfjs-electron.cjs
|   |-- prepare-mobile-ota.mjs
|   |-- prepare-native-mobile-assets.mjs
|   |-- prepare-mobile-apk-manifest.mjs
|   |-- generate-icon.cjs / generate-mobile-icons.mjs
|   |-- download-dictionaries.mjs / extract-dictionaries.mjs
|   |-- shims/                  # Module shims (e.g., canvas-optional.cjs)
|
|-- vendor/                     # Vendored dependencies
|   |-- pdfjs-4.10.38/          # Full PDF.js 4.10.38 source (for custom builds)
|
|-- resources/                  # Static resources
|   |-- icons/                  # App icons (various sizes, .ico, .png)
|   |-- pdfjs-viewer/           # PDF.js viewer customization
|
|-- config/
|   |-- supabase/               # Supabase configuration
|
|-- docs/                       # Documentation (12 markdown files)
|   |-- architecture.md
|   |-- development.md
|   |-- release.md
|   |-- data-and-sync.md
|   |-- mobile-release.md
|   |-- pdf-reader-architecture.md
|   |-- ... (and more)
|
|-- public/                     # Public static assets (logos, images, PDF.js assets)
|
|-- dist/                       # Vite build output (desktop renderer)
|-- dist-electron/              # Vite build output (Electron main process + preload)
|-- dist-mobile/                # Vite build output (mobile web bundle)
|-- release/                    # Electron Builder output (installers)
|-- build/                      # Build artifacts
|
|-- index.html                  # Desktop HTML entry point
|-- package.json                # Project manifest
|-- package-lock.json           # Dependency lock file
|-- capacitor.config.ts         # Capacitor configuration
|-- electron-builder.json5      # Electron Builder configuration
|-- vite.config.ts              # Desktop Vite config (with Electron plugin)
|-- vite.mobile.config.ts       # Mobile Vite config (separate build pipeline)
|-- tsconfig.json               # TypeScript config (renderer + electron)
|-- tsconfig.node.json          # TypeScript config (Vite/Capacitor configs)
|-- tailwind.config.js          # Tailwind CSS config
|-- .eslintrc.cjs               # ESLint config
|-- .env.example                # Environment variable template
|-- .env                        # Environment variables (gitignored)
|-- .gitignore
|-- LICENSE                     # MIT
|-- README.md                   # Project overview
|-- FEATURES.md                 # Feature roadmap/changelog (in Portuguese)
4. Current Build and Distribution Setup
Desktop (Electron):
Step	Command	Description
Dev	npm run dev	Runs PDF.js prep, asset verification, then Vite dev server with Electron
Build	npm run build	Full build: PDF.js prep, TypeScript check, Vite build, Electron verification
Package	npm run dist	Build + Electron Builder to create platform installers
Linux-specific	npm run dist:linux	Build + Electron Builder for Linux AppImage, DEB, and RPM (gzip compression)
Electron Builder outputs (release/ directory):
- Windows 10/11: NSIS installers for x64 and ARM64
- Windows 7/8/8.1: x64 Legacy NSIS installer built with Electron 22
- Linux: AppImage, DEB, and RPM for x86_64
- Android: signed ARM64 and universal APKs
Build configuration highlights:
- asar: true with selective unpacking for native modules (better-sqlite3, sharp, @napi-rs/canvas, worker chunks)
- afterPack hook (scripts/electron-after-pack.cjs): prunes locales (keeps pt-BR + en-US only), removes source maps, verifies worker bundle in asar, checks native module presence
- Modern desktop auto-update metadata is attached to the unified GitHub Release; Legacy auto-update is disabled
- File associations for .pdf and .epub
- Custom protocol: lyceum:// (used for auth deep links like password reset)
- Maximum compression
Mobile (Capacitor):
Step	Command	Description
Dev	npm run dev:mobile	Vite dev server with mobile config, bound to 127.0.0.1
Build	npm run build:mobile	TypeScript check + Vite build with mobile config to dist-mobile/
OTA	npm run mobile:ota	Build mobile + create Capgo-compatible OTA bundle
Native Assets	npm run mobile:native-assets	Prepare native Android assets
Sync	npm run cap:sync	Build + cap sync to sync web assets to native projects
Mobile distribution:
- OTA Updates: Via @capgo/capacitor-updater, hosted as GitHub Release assets (ZIP + JSON manifest)
- Android APK: Built and signed via Gradle in CI, with SHA-256 verification and version code validation
- iOS: Scaffolded but explicitly excluded from the release workflow
5. CI/CD Configurations
There are 2 GitHub Actions workflows:
a) .github/workflows/main.yml -- Unified Product Release
- Trigger: Push of a stable `vX.Y.Z` tag or manual dispatch with an existing tag
- `validate-release` requires the tag and `package.json` version to match
- Windows modern, Windows Legacy, Linux, and Android build in parallel and upload GitHub Actions artifacts
- Only `publish-release` has `contents: write`; it validates and checksums the complete set, creates a draft, uploads every asset, and then publishes it as Latest
- No platform build invokes Electron Builder publishing or creates an independent release
- Secrets required: Android signing secrets and the public Supabase runtime configuration
b) .github/workflows/docs.yml -- Documentation
- Trigger: Push to main affecting docs/**, README.md, or the workflow file
- Deploys documentation to GitHub Pages
6. Dependencies
Production Dependencies (17):
Package	Purpose
better-sqlite3	Local SQLite database (native module)
sharp	Image processing / thumbnails (native module)
@napi-rs/canvas	Canvas operations (native module)
pdfjs-dist (4.10.38)	PDF rendering
pdf-lib	PDF manipulation
jsdom	DOM parsing (EPUB processing)
jszip	ZIP file handling (EPUB, CBZ)
adm-zip	ZIP file handling
chokidar	File system watching
@supabase/supabase-js	Cloud backend
electron-updater	Auto-update mechanism
graphology + graphology-layout-forceatlas2	Graph data structures and layout
sigma	Graph visualization
wink-lemmatizer	Word lemmatization (dictionary)
tar, xz-decompress	Archive handling (dictionary packages)
@capacitor/core, @capacitor/android, @capacitor/ios, @capacitor/filesystem, @capacitor/preferences	Capacitor mobile framework
@capgo/capacitor-updater	OTA updates for mobile
@codemirror/*	Rich text editing (6 packages)
Dev Dependencies (42+):
Category	Key Packages
Build	vite 5, @vitejs/plugin-react, vite-plugin-electron, vite-plugin-electron-renderer, electron-builder, @capacitor/cli, @capgo/cli
Framework	react 18, react-dom 18, react-router-dom 7, @tanstack/react-query 5
UI	tailwindcss 4, @tailwindcss/vite, lucide-react, motion 12, recharts 3, @dnd-kit/*, @radix-ui/react-select, @uiw/react-heat-map, react-hot-toast
Reader	epubjs
Testing	vitest 1.4, @vitest/coverage-v8, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom
Linting	eslint 8, @typescript-eslint/*, eslint-plugin-react-hooks, eslint-plugin-react-refresh
Types	@types/react, @types/react-dom, @types/better-sqlite3, @types/chokidar
Electron	electron 30
7. Platform-Specific Code and Configurations
The project has significant platform-specific code across three target platforms:
Desktop -- Windows:
- /home/higino-neto/dev/lyceum/electron/services/windows-file-clipboard.ts: PowerShell-based file clipboard using System.Windows.Forms.Clipboard.SetFileDropList
- MTP device detection via PowerShell COM automation (Shell.Application Namespace 17) in electron/main.ts -- over 500 lines of PowerShell scripts for Kindle/MTP device discovery and file transfer
- NSIS installers for Windows 10/11 x64 and ARM64, plus Electron 22 Legacy x64
- Windows drive letter scanning for USB devices (A:\ through Z:\)
- afterPack hook prunes Windows-specific unused files (better-sqlite3 deps/src, sharp src/install)
Desktop -- macOS:
- Shared application code retains macOS paths, but macOS is not currently an official CI release target
Desktop -- Linux:
- AppImage, DEB, and RPM formats for x86_64 (gzip-compressed AppImage)
- Artifact convention: Lyceum-${version}-Linux-x86_64.${ext}
- /home/higino-neto/dev/lyceum/electron/services/removable-volumes.ts: Scans /media/<user>, /run/media/<user>, /mnt, and GVFS MTP mounts (/run/user/<uid>/gvfs) for e-reader detection
- /home/higino-neto/dev/lyceum/electron/services/linux-file-clipboard.ts: Builds text/uri-list or x-special/gnome-copied-files clipboard payloads depending on desktop environment (GNOME/Unity/Cinnamon/Mate/Budgie detection)
- Must be built natively on Linux (README explicitly states "Linux release artifacts should not be cross-built from Windows")
Mobile -- Android:
- Full Capacitor Android project in /home/higino-neto/dev/lyceum/android/
- applicationId: com.higino.lyceum.mobile
- Version code derived from semver (major * 1,000,000 + minor * 1,000 + patch)
- Release signing via environment-injected keystore
- Custom native APK updater with SHA-256 verification, version code validation, and signing certificate checks (nativeApkUpdater.ts)
- OTA web bundle updates via Capgo
Mobile -- iOS:
- Capacitor iOS scaffold exists in /home/higino-neto/dev/lyceum/ios/
- Explicitly excluded from the release workflow (noted in FEATURES.md: "remove iOS deployment from GitHub releases for now")
Multi-platform shared concerns:
- Locale pruning: Only pt-BR and en-US are shipped in desktop builds
- The app uses process.platform checks extensively in electron/main.ts for branching USB scanning, clipboard operations, and file system behavior
- E-reader detection adapts to all three desktop OSes (Windows drive letters, macOS /Volumes, Linux media/run/media/mnt/gvfs paths)
8. Key Files and Their Locations
File	Path	Role
README	/home/higino-neto/dev/lyceum/README.md	Project overview and download links
Package manifest	/home/higino-neto/dev/lyceum/package.json	Dependencies, scripts, build config
Desktop Vite config	/home/higino-neto/dev/lyceum/vite.config.ts	Main build pipeline with Electron plugin
Mobile Vite config	/home/higino-neto/dev/lyceum/vite.mobile.config.ts	Mobile web bundle build
Capacitor config	/home/higino-neto/dev/lyceum/capacitor.config.ts	Mobile native bridge config
Electron Builder config	/home/higino-neto/dev/lyceum/electron-builder.json5	Packaging targets for all platforms
Electron main	/home/higino-neto/dev/lyceum/electron/main.ts	Main process entry (1900+ lines, IPC handlers, USB/Kindle)
Electron preload	/home/higino-neto/dev/lyceum/electron/preload.ts	Context bridge exposing window.api (687 lines)
Desktop entry	/home/higino-neto/dev/lyceum/src/main.tsx	React renderer entry point
App shell	/home/higino-neto/dev/lyceum/src/App.tsx	Main UI layout, routing, settings (822 lines)
Mobile entry	/home/higino-neto/dev/lyceum/src/mobile/main.tsx	Mobile React entry point
Mobile app	/home/higino-neto/dev/lyceum/src/mobile/MobileApp.tsx	Mobile UI shell
Route definitions	/home/higino-neto/dev/lyceum/src/navigation/routes.ts	Navigation routes and hotkey bindings
Supabase client	/home/higino-neto/dev/lyceum/src/lib/supabase.ts	Cloud client with graceful disabled fallback
SQLite database	/home/higino-neto/dev/lyceum/electron/local-database.ts	Local data persistence
USB detection	/home/higino-neto/dev/lyceum/electron/services/removable-volumes.ts	Cross-platform volume scanning
Linux clipboard	/home/higino-neto/dev/lyceum/electron/services/linux-file-clipboard.ts	Linux file drag/clipboard
Windows clipboard	/home/higino-neto/dev/lyceum/electron/services/windows-file-clipboard.ts	Windows file clipboard via PowerShell
Post-pack hook	/home/higino-neto/dev/lyceum/scripts/electron-after-pack.cjs	Build verification and locale pruning
Product CI/CD	/home/higino-neto/dev/lyceum/.github/workflows/main.yml	Unified Windows + Linux + Android release pipeline
Docs CI/CD	/home/higino-neto/dev/lyceum/.github/workflows/docs.yml	GitHub Pages deployment
Android build	/home/higino-neto/dev/lyceum/android/app/build.gradle	Android Gradle build config
Architecture docs	/home/higino-neto/dev/lyceum/docs/architecture.md	System architecture
Release docs	/home/higino-neto/dev/lyceum/docs/release.md	Release process
Mobile release docs	/home/higino-neto/dev/lyceum/docs/mobile-release.md	Mobile release process
Env template	/home/higino-neto/dev/lyceum/.env.example	Required environment variables
Vendored PDF.js	/home/higino-neto/dev/lyceum/vendor/pdfjs-4.10.38/	Full PDF.js source for custom builds
