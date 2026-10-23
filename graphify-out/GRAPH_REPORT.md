# Graph Report - lyceum  (2026-10-23)

## Corpus Check
- Large corpus: 602 files · ~332,106 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 4527 nodes · 12982 edges · 185 communities (162 shown, 23 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 223 edges (avg confidence: 0.85)
- Token cost: 14,500 input · 9,800 output

## Community Hubs (Navigation)
- Shared Library Data Model
- Kindle Send Pipeline
- Kindle Conversion and Dictionaries
- Library File Operations
- Settings and Update UI
- Library Context and Folders
- EPUB Parsing and Validation
- Users and Ranking Periods
- Tab Bar and Buffer Cache
- Reading and Social Categories
- Book Format Exporters
- Auth and Profile UI
- App Settings and Appearance
- Library Job Queue
- HTML Sanitization and Import
- Statistics and Charts
- Book Search and Backup
- Native Build Scripts
- Conversion API Profiles
- Comic Package Paths
- Reading Status Board
- EPUB.js Reader Pane
- Mobile Library Screens
- App Updater and Releases
- Rankings and Social Fetch
- Metadata Search and Save
- EPUB Content Blocks
- Library Folder Drag and Drop
- i18n Select and Translate
- Package Dev Dependencies
- Dictionary Language Learning
- Book Metadata Editing
- Section Nodes and Clusters
- Package Manifest
- AZW3 Writer Body Records
- Package Scripts
- Mobile App Library Views
- Core Dependencies
- i18n Resource Bundles
- Book File Metadata Extraction
- Import and Thumbnail Dialogs
- Habit Tracker Page
- Mobile Backup and Annotations
- Mobile PDF Pane
- Book Grid and List Layouts
- Dictionary Storage and StarDict
- Library Query Builder
- Mobile Dashboard Charts
- SQLite Schema and Migrations
- PalmDB and EXTH Writer
- OPF Parser
- PDF Reader Core Contract
- Vocabulary Panel
- Desktop Release Resolver
- Thumbnail Generation Helpers
- Mobile Leaderboard Screen
- Concept Graph Editor
- PDF Text Geometry Analysis
- Mobile Book Import Bridge
- EPUB Table of Contents
- Reader Control Settings
- Folder Breadcrumb Navigation
- Reader Toolbar
- Backup IPC Tests
- File Tree Utilities
- PDF.js Chapter Rendering
- Event Bus Helpers
- AZW3 CNCX and INDX Records
- PDF to EPUB Text Blocks
- Form Draft and Validation
- Annotation Repository Tests
- Electron API Types
- EPUB Exporter Resources
- CBZ Importer
- Reading Status and Book Cards
- Mobile Account Gate
- Mobile Thumbnail Extraction
- Book IPC Handlers
- PDF Selection and Annotations
- AZW3 Validation Pipeline
- SQLite Document Query
- Architecture Check Scripts
- Category IPC Handlers
- Mobile Icon Generation
- Kindle Firmware Quirks
- AZW3 Resources and KF8 CSS
- EPUB Packaging
- Document File Metadata Index
- Dictionary Manager
- Mobile Error and Confirm UI
- Skeleton Components
- Thumbnail Storage
- TypeScript Config
- Annotation Repository
- Habit Validation
- Processing Worker Pool
- Mobile APK Manifest Script
- PDF Noise and Line Analysis
- Kindle Send Panel
- Reading State Persistence
- Mobile Release Docs
- Language Storage and JsonTree
- Electron Import Verification
- i18n Language Config
- Bounding Box Math
- Font Size Scoring
- Viewer Core Text Selection
- Concept Link Picker
- Architecture Highlights
- Navigation Bootstrap
- Books In Folder Hook
- Mobile Reading API
- Concept List Filters
- Habit IPC Handlers
- Zoom and Platform Handlers
- Icon Generation Scripts
- CSS Import Inlining
- Vite Build Chunks
- Architecture Import Check
- Document File Repository
- Chapter Progress Storage
- Adm-Zip Type Declarations
- Migration Tests
- Window Handler Tests
- PDF Buffer Cache
- PDF Reader Type Guards
- Navigation Guards
- AZW3 Build Records
- PDF Column Layout
- Annotation Empty State
- PDF.js Viewer
- KFX Previewer Docs
- Watch Folder Repository
- Word Index Repository
- PDF Font Analysis
- Electron Main and Preload Bridge
- SQLite Database Architecture
- Reading Stats and Supabase
- File Dialog Tests
- Strict TypeScript Config
- External Book Search
- Result and Domain Errors
- AZW3 Record Assertions
- Library Filter Bar
- Test Mocks
- Node TypeScript Config
- Desktop Dev and IPC Docs
- Development Setup Docs
- Canvas PDF Rendering
- Electron Worker Verification
- PDF.js Asset Verification
- Conversion and Dictionary Docs
- Library Reader Docs
- PDF.js Asset Path
- Dictionary Download Script
- AZW3 TBS Indexing
- Source Folder Bridge
- Chapter Sidebar
- Concept Graph Docs
- Typed PDF Contract Docs
- Security Policy Tests
- Vocabulary Service
- Dictionary Extraction Script
- App Updater Bridge
- API Type Declarations
- Release Pipeline Docs
- Dev Workflow Docs
- Stat Card Component
- Book Data Hook
- JSDOM Type Declarations
- Capacitor Config
- Package Author Metadata
- Logo Component
- Migration Helper
- Mobile Release Workflow Test
- Supabase Config Test

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 226 edges
2. `translate()` - 137 edges
3. `react` - 135 edges
4. `vitest` - 126 edges
5. `lucide-react` - 100 edges
6. `registerBookHandlers()` - 95 edges
7. `MobileApp()` - 58 edges
8. `registerLibraryHandlers()` - 52 edges
9. `BookWithThumbnail` - 46 edges
10. `@testing-library/react` - 42 edges

## Surprising Connections (you probably didn't know these)
- `Lyceum Mobile HTML entry (pt-BR, viewport-fit=cover)` --semantically_similar_to--> `React root mount with boot.ts before main.tsx`  [INFERRED] [semantically similar]
  src/mobile/index.html → index.html
- `KindleSendBookInput` --references--> `BookFormat`  [EXTRACTED]
  electron/main.ts → src/lib/lyceum/schema/types.ts
- `SQLite schema startup sequence (bootstrap to post-migration)` --conceptually_related_to--> `Local SQLite database (better-sqlite3)`  [INFERRED]
  docs/architecture.md → ARCHITECTURE.md
- `BookEdge spatial page edge in the desktop PDF reader` --conceptually_related_to--> `Custom zoom-aware PDF text selection`  [INFERRED]
  docs/book-edge.md → FEATURES.md
- `FOUC prevention at HTML, boot module and Electron window levels` --references--> `Pre-paint inline theme resolution script (index.html)`  [EXTRACTED]
  docs/design-tokens.md → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Theme application pipeline (pre-paint to tokens to Tailwind utilities)** — index_prepaint_theme_script, index_root_mount, docs_design_tokens_source_of_truth, docs_design_tokens_runtime_flow, docs_design_tokens_tailwind_mapping, docs_design_tokens_fouc [EXTRACTED 1.00]
- **Modular monolith architecture rules and enforcement** — docs_adr_001_modular_monolith, docs_adr_001_ports_and_adapters, docs_adr_001_vertical_slice_migration, docs_adr_001_window_api_contract, docs_architecture_architecture_check, docs_architecture_runtime_shape [EXTRACTED 1.00]
- **Unsynced-to-synced document lifecycle** — docs_architecture_synced_unsynced_documents, docs_data_and_sync_document_sync_flow, docs_data_and_sync_safety_rules, docs_data_and_sync_local_sqlite [INFERRED 0.85]
- **Lyceum Four Main Product Areas** — docs_index_dashboard, docs_index_register_reading, docs_index_library, docs_index_reader [EXTRACTED 1.00]
- **Global Release and Updater Pipeline** — docs_release_global_version_model, docs_release_workflow_main, docs_release_validation_job, docs_release_android_versioncode, docs_release_updater_manifests, docs_release_secrets_signing [EXTRACTED 1.00]
- **Mobile Library Adaptation Set** — docs_mobile_library_checklist_managed_storage, docs_mobile_library_checklist_source_folder, docs_mobile_library_checklist_mobile_readers, docs_mobile_library_checklist_quality_gate [INFERRED 0.85]

## Communities (185 total, 23 thin omitted)

### Community 0 - "Shared Library Data Model"
Cohesion: 0.03
Nodes (104): dissolveDegenerateLogicalGroup(), getAnnotationPageThumbnailPath(), getAnnotationsDirectory(), registerBookHandlers(), buildAtlasNoteHeader(), downloadCoverImage(), ensureAtlasNotePath(), escapeYaml() (+96 more)

### Community 1 - "Kindle Send Pipeline"
Cohesion: 0.03
Nodes (123): setFileWatcherRefresh(), addDocument(), getDocumentByFilePath(), activeConversionControllers, appendKindleOutputSuffix(), appendUrlSearchParams(), assertPathWithin(), buildUsbBookRecord() (+115 more)

### Community 2 - "Kindle Conversion and Dictionaries"
Cohesion: 0.04
Nodes (68): DEFAULT_INDEX, DictionaryIndex, DictionaryInfo, decompressXzToTar(), extractNestedTarArchives(), childDirectories(), enumerateMountedVolumeRoots(), getCandidateVolumeRoots() (+60 more)

### Community 3 - "Library File Operations"
Cohesion: 0.06
Nodes (89): emitLibraryUpdated(), registerLibraryHandlers(), setWindow(), addSourceFolder(), addTypedWatchFolder(), addWatchFolder(), deleteDocumentsUnderPath(), getAllDocuments() (+81 more)

### Community 4 - "Settings and Update UI"
Cohesion: 0.05
Nodes (77): updateUserProfile(), App(), AppShell(), ConfirmDialog(), ConfirmDialogProps, ProtectedRoute(), ProtectedRouteProps, isSettingsTabId() (+69 more)

### Community 5 - "Library Context and Folders"
Cohesion: 0.05
Nodes (67): LibraryContext, LibraryContextValue, LibraryProvider(), toSourceFolder(), useOptionalLibraryContext(), visibleFolders(), FolderOperationResult, runWithRefresh() (+59 more)

### Community 6 - "EPUB Parsing and Validation"
Cohesion: 0.06
Nodes (76): jsdom, jszip, byLocalName(), decodeTextBytes(), detectBomEncoding(), detectDeclaredEncoding(), detectUtf16WithoutBom(), parseContainerXml() (+68 more)

### Community 7 - "Users and Ranking Periods"
Cohesion: 0.06
Nodes (62): motion, @uiw/react-heat-map, getUserReadings(), SelectedUser, SelectedUsersContext, SelectedUsersContextType, useSelectedUsers(), SetValue (+54 more)

### Community 8 - "Tab Bar and Buffer Cache"
Cohesion: 0.06
Nodes (61): @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, TabBar(), TabBarProps, BaseTabProps, TabDragPreview(), TabItem() (+53 more)

### Community 9 - "Reading and Social Categories"
Cohesion: 0.07
Nodes (60): acceptFriendRequest(), BookReading, cancelFriendRequest(), Category, createReadingEntry(), declineFriendRequest(), deleteBook(), deleteReadingEntry() (+52 more)

### Community 10 - "Book Format Exporters"
Cohesion: 0.07
Nodes (40): ConversionRegistry, createDefaultConversionRegistry(), Azw3Exporter, EpubExporter, ChapterTarget, clamp(), decodeFragment(), HtmlExporter (+32 more)

### Community 11 - "Auth and Profile UI"
Cohesion: 0.08
Nodes (52): lucide-react, react-hot-toast, react-router-dom, createUserProfile(), authButtonClasses, AuthField(), authInputClasses, AuthShell() (+44 more)

### Community 12 - "App Settings and Appearance"
Cohesion: 0.07
Nodes (53): AppSettings, AppSettingsContext, AppSettingsContextValue, AppSettingsProvider(), DEFAULT_SETTINGS, loadLegacyAutoHideSettings(), loadSettings(), saveSettings() (+45 more)

### Community 13 - "Library Job Queue"
Cohesion: 0.07
Nodes (58): applyBookThumbnail(), syncMergedBookThumbnail(), WatchFolderRecord, getDocumentByPath(), updateDocumentFileIdentity(), updateDocumentNumPages(), updateFileSize(), updateMetadata() (+50 more)

### Community 14 - "HTML Sanitization and Import"
Cohesion: 0.09
Nodes (47): ACTIVE_TAGS, assertValidXhtmlDocument(), decodeHtmlBytes(), documentTitle(), ensureDocument(), ensureXhtmlNamespaces(), firstHeading(), hasMeaningfulHtmlContent() (+39 more)

### Community 15 - "Statistics and Charts"
Cohesion: 0.10
Nodes (43): recharts, formatShortDate(), getWeekdayShortNames(), AreaChartComponent(), AreaChartProps, CategoryChartProps, CategoryChartType, CategoryDataItem (+35 more)

### Community 16 - "Book Search and Backup"
Cohesion: 0.06
Nodes (41): @supabase/supabase-js, BookSearchInput(), BookSearchInputProps, BackupResult, BackupSettings, usePeriodicBackup(), Book, LocalBook (+33 more)

### Community 17 - "Native Build Scripts"
Cohesion: 0.05
Nodes (43): buildWindowsFileClipboardCommand(), copyWindowsFilesToClipboard(), execFileAsync, nodeBindingBackup, root, temporaryDirectory, backupNodeBinding(), betterSqliteBinary (+35 more)

### Community 18 - "Conversion API Profiles"
Cohesion: 0.07
Nodes (49): BookConversionConfig, canConvertBook(), ConversionApi, ConversionLogEntry, ConversionOptions, ConversionOutputFormat, ConversionProfile, ConversionQueueContext (+41 more)

### Community 19 - "Comic Package Paths"
Cohesion: 0.12
Nodes (49): comicPagesPath(), LYCEUM_SCHEMA_VERSION, manifestPath(), metadataPath(), normalizePackageRelativePath(), originalSourcePath(), packagePath(), TEXTUAL_ROOT (+41 more)

### Community 20 - "Reading Status Board"
Cohesion: 0.10
Nodes (45): getTitleWithoutExtension(), compareText(), normalizeCase(), getReadingStatusLabel(), AtlasPage(), AddTarget, ATLAS_BOOKS_QUERY_KEY, ATLAS_STATUS_QUERY_KEY (+37 more)

### Community 21 - "EPUB.js Reader Pane"
Cohesion: 0.08
Nodes (36): epubjs, EpubBook, EpubRendition, EpubSection, SearchHit, TocItem, buildExcerpt(), buildOverrideCss() (+28 more)

### Community 22 - "Mobile Library Screens"
Cohesion: 0.10
Nodes (41): @capacitor/preferences, descendantFolderIds(), findDuplicateBook(), folderPath(), formatFileSize(), getBookProgress(), MobileLibraryQuery, queryMobileBooks() (+33 more)

### Community 23 - "App Updater and Releases"
Cohesion: 0.09
Nodes (41): @capgo/capacitor-updater, translate(), AppUpdater, AppUpdaterDownloadOptions, AppUpdaterDownloadProgress, canRequestPackageInstalls(), downloadAndInstallApk(), getInstalledAppVersion() (+33 more)

### Community 24 - "Rankings and Social Fetch"
Cohesion: 0.07
Nodes (32): @tanstack/react-query, @testing-library/react, SelectedUsersProvider(), fetchCategoryRanking(), fetchFullRanking(), fetchRanking(), mapRankingRow(), RankingRow (+24 more)

### Community 25 - "Metadata Search and Save"
Cohesion: 0.09
Nodes (44): attrValue(), BookMetadataCandidate, BookMetadataSearchResponse, buildGoogleBooksUrl(), buildLocUrl(), buildOpenLibraryUrl(), candidateToEditableMetadata(), cleanArray() (+36 more)

### Community 26 - "EPUB Content Blocks"
Cohesion: 0.09
Nodes (40): pdf-lib, addPage(), BinaryInput, BlockType, cleanText(), ContentBlock, convertEpubToPdf(), decodeEntities() (+32 more)

### Community 27 - "Library Folder Drag and Drop"
Cohesion: 0.10
Nodes (35): useLibraryContext(), classifyFolder(), classifyFolders(), FolderType, buildDisplayBooks(), buildSpecialFolderBook(), collectSpecialFoldersForDisplay(), getBookSortDate() (+27 more)

### Community 28 - "i18n Select and Translate"
Cohesion: 0.08
Nodes (31): i18next, @radix-ui/react-select, react, @tanstack/react-virtual, getBookReadings(), Select(), SelectItem, SelectProps (+23 more)

### Community 29 - "Package Dev Dependencies"
Cohesion: 0.05
Nodes (43): devDependencies, autoprefixer, @capacitor/cli, @capgo/cli, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, electron (+35 more)

### Community 30 - "Dictionary Language Learning"
Cohesion: 0.09
Nodes (36): extractMetadata(), logStartupEnvironment(), EditableBookMetadata, BookFileType, extractEpubMetadata(), extractPdfMetadata(), formatPdfDate(), getPdfPageCount() (+28 more)

### Community 31 - "Book Metadata Editing"
Cohesion: 0.10
Nodes (35): sanitizeLookupWord(), simplifyEnglishText(), cleanDictionaryHtml(), cleanText(), DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DICTIONARY_SUPPORTED_LANGUAGES, DictionaryDefinition (+27 more)

### Community 32 - "Section Nodes and Clusters"
Cohesion: 0.08
Nodes (27): bookSections(), edgePage(), rifflePages(), SectionNode, Bounds, clusterIntoLines(), ClusterItem, ClusterLine (+19 more)

### Community 33 - "Package Manifest"
Cohesion: 0.05
Nodes (38): description, main, name, private, type, version, autoprefixer, @capacitor/android (+30 more)

### Community 34 - "AZW3 Writer Body Records"
Cohesion: 0.08
Nodes (37): addAidAttributes(), Azw3BuildResult, BodySplit, bookIdentifierSeed(), buildExth(), buildExthRecord(), buildRecordZero(), controlByteFor() (+29 more)

### Community 35 - "Package Scripts"
Cohesion: 0.05
Nodes (37): scripts, build, build:mobile, cap:open:android, cap:open:ios, cap:sync, check, check:architecture (+29 more)

### Community 36 - "Mobile App Library Views"
Cohesion: 0.11
Nodes (35): deleteMobileBookFile(), ensureFolderPath(), sanitizeFolderName(), canExtractThumbnail(), EmptyState(), EpubPane, extractThumbnailPatch(), formatMobileBytes() (+27 more)

### Community 37 - "Core Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, adm-zip, better-sqlite3, @capacitor/android, @capacitor/core, @capacitor/filesystem, @capacitor/ios, @capacitor/preferences (+27 more)

### Community 39 - "Book File Metadata Extraction"
Cohesion: 0.12
Nodes (31): FileMetadataUpdateResult, EpubMetadata, PdfMetadata, applyBookCover(), applyPdfCover(), ConversionProgress, convertEpubToPdf(), convertPdfToEpub() (+23 more)

### Community 40 - "Import and Thumbnail Dialogs"
Cohesion: 0.12
Nodes (27): react-i18next, ImportBookDialog(), ImportBookDialogProps, SetThumbnailDialog(), SetThumbnailDialogProps, AnimatedModal(), AnimatedModalProps, BOOK_READING_STATUS_VALUES (+19 more)

### Community 41 - "Habit Tracker Page"
Cohesion: 0.12
Nodes (27): DayCell, DayCellComponent(), DayCellProps, formatMeasurementValue(), HabitRow(), HabitRowProps, MonthNavigator(), MonthNavigatorProps (+19 more)

### Community 42 - "Mobile Backup and Annotations"
Cohesion: 0.15
Nodes (27): createMobileBackup(), hashMobileFile(), MobileBackup, parseMobileBackup(), MobileBackupPanel(), capturePdfAnchor(), PdfVisualAnchor, relativePoint() (+19 more)

### Community 43 - "Mobile PDF Pane"
Cohesion: 0.14
Nodes (30): dataUrlToUint8Array(), FindStatus, getFindLabel(), getFriendlyPdfError(), LayoutButton(), NavigationTab, PanelEmpty(), PdfMetadata (+22 more)

### Community 44 - "Book Grid and List Layouts"
Cohesion: 0.10
Nodes (25): ListLayoutMode, FolderListItem(), FolderListItemProps, formatCount(), BookGrid(), BookGridProps, DEFAULT_COLUMNS, EMPTY_FOLDERS (+17 more)

### Community 45 - "Dictionary Storage and StarDict"
Cohesion: 0.10
Nodes (16): closeAllStorage(), DictionaryStorage, getDictionaryStorage(), StarDictEntry, storageCache, registerDictionaryHandlers(), irregularAdjectives, irregularPlurals (+8 more)

### Community 46 - "Library Query Builder"
Cohesion: 0.11
Nodes (24): buildLibraryQuery(), BuiltLibraryQuery, LibraryQueryInput, DisplayBooksInput, LIBRARY_STATUS_FILTER_VALUES, resetThumbnailCacheForTests(), SectionTabsProps, getUsbApi() (+16 more)

### Community 47 - "Mobile Dashboard Charts"
Cohesion: 0.16
Nodes (27): ChartMode, dateLabelForHeatmap(), EmptyChart(), formatShortDate(), getTodayReadingsText(), MobileDashboardScreen(), StatTile(), addDays() (+19 more)

### Community 48 - "SQLite Schema and Migrations"
Cohesion: 0.26
Nodes (12): CURRENT_SQLITE_SCHEMA_VERSION, documentColumns, migrations, runDatabaseMigrations(), SqliteDatabase, createSqliteDocumentSearchIndex(), ensureApplicationSchema(), ensureBootstrapSchema() (+4 more)

### Community 49 - "PalmDB and EXTH Writer"
Cohesion: 0.16
Nodes (29): atomicWrite(), buildExth(), buildPalmDb(), cleanString(), escapeXml(), execFileAsync, exthStringRecord(), exthUIntRecord() (+21 more)

### Community 50 - "OPF Parser"
Cohesion: 0.20
Nodes (29): allDc(), allElementsByLocalName(), attr(), cleanText(), collectRefinements(), customMetadata(), dcElements(), descendantsByLocalName() (+21 more)

### Community 51 - "PDF Reader Core Contract"
Cohesion: 0.17
Nodes (24): BookLandmark, CMD_GET_STATE, CMD_NAVIGATE, CMD_RESTORE, CMD_SET_ANNOTATIONS_STATE, CMD_SET_BOOK_LANDMARKS, CMD_SET_CHAPTERS_STATE, CMD_SET_HIGHLIGHTS (+16 more)

### Community 52 - "Vocabulary Panel"
Cohesion: 0.15
Nodes (25): buildVocabularyStorageKey(), cycleVocabularyStatus(), cycleVocabularyStatusInverse(), DEFAULT_VOCABULARY_STATE, extractUniqueWords(), getVocabularyStatusClasses(), getVocabularyStatusLabelKey(), normalizeVocabularyWord() (+17 more)

### Community 53 - "Desktop Release Resolver"
Cohesion: 0.15
Nodes (25): desktopMetadataName(), desktopUpdateChannel(), GithubRelease, GithubReleaseAsset, hasDesktopArtifact(), resolveDesktopRelease(), checkForAppUpdates(), configureDesktopReleaseFeed() (+17 more)

### Community 54 - "Thumbnail Generation Helpers"
Cohesion: 0.13
Nodes (20): findKfxlibRoot(), findThumbnailByHash(), generateAzw3Thumbnail(), generateCbzThumbnail(), generateEpubThumbnail(), generateKfxThumbnail(), generateThumbnail(), GenerateThumbnailOptions (+12 more)

### Community 55 - "Mobile Leaderboard Screen"
Cohesion: 0.15
Nodes (26): invalidateSocialQueries(), MobileFriendsPanel(), acceptMobileFriendRequest(), AuthenticatedClient, cancelMobileFriendRequest(), canUseMobileSupabase(), declineMobileFriendRequest(), findMobileUserByNickname() (+18 more)

### Community 56 - "Concept Graph Editor"
Cohesion: 0.15
Nodes (16): graphology, sigma, conceptAccent(), ConceptEditorProps, GraphDialog(), GraphDialogProps, buildConceptGraphModel(), ConceptGraphEdgeModel (+8 more)

### Community 57 - "PDF Text Geometry Analysis"
Cohesion: 0.15
Nodes (22): analyzeFontSizes(), assignClusterLabel(), buildHistogram(), buildLines(), buildLineText(), computeDocumentStats(), createLine(), extractImageCandidatesFromPdfJsPage() (+14 more)

### Community 58 - "Mobile Book Import Bridge"
Cohesion: 0.14
Nodes (17): acknowledgeNativeBook(), getPendingNativeBooks(), IncomingBooks, IncomingBooksPlugin, listenForIncomingBooks(), loadNativeBook(), NativeImportFile, pickNativeBooks() (+9 more)

### Community 59 - "EPUB Table of Contents"
Cohesion: 0.15
Nodes (23): LearningOverlayAnchor, DictionaryLookupResult, decodeHtmlEntities(), flattenToc(), TableOfContents(), TableOfContentsProps, NavItem, ActiveSelectionLookup (+15 more)

### Community 60 - "Reader Control Settings"
Cohesion: 0.17
Nodes (20): @capacitor/core, @capacitor/filesystem, exportMobileBook(), blobToDataUrl(), extensionFor(), folderPart(), getStoredBookPatch(), mimeFor() (+12 more)

### Community 61 - "Folder Breadcrumb Navigation"
Cohesion: 0.22
Nodes (19): calculateSimilarity(), levenshteinSimilarity(), normalizeText(), tokenize(), FolderGrid(), FolderGridContextMenuState, FolderPathBar(), FolderPathBarProps (+11 more)

### Community 62 - "Reader Toolbar"
Cohesion: 0.17
Nodes (22): getLanguageDisplayName(), SUPPORTED_LANGUAGES, ReaderToolbar(), ReaderToolbarProps, THEME_LABEL_KEYS, DEFAULT_SETTINGS, EpubReadingMode, FONT_OPTIONS (+14 more)

### Community 63 - "Backup IPC Tests"
Cohesion: 0.19
Nodes (17): backupAllCategories(), backupAllDocuments(), backupAllHabits(), backupCategory, backupDocument, backupDocumentCategory, BackupDocumentInput, backupHabit (+9 more)

### Community 64 - "File Tree Utilities"
Cohesion: 0.10
Nodes (18): default(), KEEP_LOCALES, listFilesRecursive(), removeMaps(), removePath(), verifyPackagedRuntime(), appAsar, appAsarSummary (+10 more)

### Community 65 - "PDF.js Chapter Rendering"
Cohesion: 0.16
Nodes (22): pdfjs-dist, buildChapterFiles(), renderDefaultCss(), buildImageBlocks(), buildMetadata(), buildReport(), convertPdfToEpub(), createIdentifier() (+14 more)

### Community 66 - "Event Bus Helpers"
Cohesion: 0.11
Nodes (3): CMD_GET_OUTLINE, EVT_OUTLINE_LOADED, outlinedResponse()

### Community 67 - "AZW3 CNCX and INDX Records"
Cohesion: 0.22
Nodes (20): buildFragmentIndxWithCncx(), buildIndxDataRecord(), buildIndxPrimary(), buildNcxIndx(), buildNcxTreeEntries(), buildSkeletonIndx(), buildSrcsRecord(), buildTagx() (+12 more)

### Community 68 - "PDF to EPUB Text Blocks"
Cohesion: 0.17
Nodes (20): PDF_TO_EPUB_CHECKLIST, BBox, Block, BlockType, ChecklistItem, ConversionReport, ConvertPdfToEpubOptions, DocumentStats (+12 more)

### Community 69 - "Form Draft and Validation"
Cohesion: 0.18
Nodes (22): useMobileConfirm(), MobileInput(), MobileSelect(), categoryForBook(), dateLabel(), Draft, draftKey(), emptyDraft() (+14 more)

### Community 70 - "Annotation Repository Tests"
Cohesion: 0.17
Nodes (19): assertBookId(), createAnnotationRepository(), assertUniqueConceptTitle(), createConcept(), createRelation(), deleteRelation(), getAnnotatedPages(), getConceptById() (+11 more)

### Community 71 - "Electron API Types"
Cohesion: 0.12
Nodes (17): LyceumApi, NodeJS, ProcessEnv, Window, api, DocumentData, LyceumApi, MetadataSearchField (+9 more)

### Community 72 - "EPUB Exporter Resources"
Cohesion: 0.17
Nodes (21): buildEpubFromLyceumPackage(), buildTocTree(), chapterExportHref(), createEpubArchive(), ensureExportableXhtml(), EpubResourceFile, loadResources(), normalizeIdentifier() (+13 more)

### Community 73 - "CBZ Importer"
Cohesion: 0.16
Nodes (21): CBZ_IMAGE_MEDIA_TYPES, CbzPageEntry, collator, collectPageEntries(), getSharp(), hasImageSignature(), IGNORED_FILE_NAMES, isUnsafeZipPath() (+13 more)

### Community 74 - "Reading Status and Book Cards"
Cohesion: 0.18
Nodes (16): READING_STATUS_LABEL_KEYS, BookCardProps, CollectionThumbnailGrid(), CollectionThumbnailTile(), areBooksEqual(), BookListItem(), ExplorerColumns, getThumbnailSrc() (+8 more)

### Community 75 - "Mobile Account Gate"
Cohesion: 0.16
Nodes (19): MobileAccountGate(), FieldFrameProps, MobileCard(), MobileFieldFrame(), Avatar(), displayName(), FriendRow(), MobileLeaderboardScreen() (+11 more)

### Community 76 - "Mobile Thumbnail Extraction"
Cohesion: 0.22
Nodes (21): dataUrlToArrayBuffer(), dirname(), extractEpubThumbnail(), extractPdfThumbnail(), extractThumbnailFromDataUrl(), extractThumbnailFromFile(), fitImageToThumbnail(), getElementsByLocalName() (+13 more)

### Community 77 - "Book IPC Handlers"
Cohesion: 0.19
Nodes (20): resolveDraggedDocuments(), deleteDocument(), getDocumentByHash(), inferDocumentReadingStatus(), toReadingMapItem(), updateAuthor(), updateDocumentFileType(), updateLastOpened() (+12 more)

### Community 78 - "PDF Selection and Annotations"
Cohesion: 0.19
Nodes (15): PdfSelectionPayload, PdfSelectionRect, AnnotationPanel(), AnnotationPanelProps, getRelatedConcepts(), buildChapterRanges(), findChapterForPage(), flattenChapters() (+7 more)

### Community 79 - "AZW3 Validation Pipeline"
Cohesion: 0.20
Nodes (20): asBuffer(), assertValidAzw3Buffer(), assertValidAzw3File(), Azw3ValidationMetadata, Azw3ValidationResult, decodeTextPreview(), decodeTextPreviewFromRecords(), decodeTextRecords() (+12 more)

### Community 80 - "SQLite Document Query"
Cohesion: 0.16
Nodes (6): createSqliteDocumentQueryRepository(), DocumentQueryRepository, ORDER_BY, tokenizeDocumentSearch(), DocumentRecord, LibraryListQuery

### Community 81 - "Architecture Check Scripts"
Cohesion: 0.16
Nodes (17): entry, outfile, relativeTarget, rootDir, checkDesignTokens(), checkElectron(), checkIsolatedViewers(), checkLegacyIsolation() (+9 more)

### Community 82 - "Category IPC Handlers"
Cohesion: 0.18
Nodes (5): registerCategoryHandlers(), DEFAULT_COLORS, DocumentWithCategories, BookCategory, CategoryRepository

### Community 83 - "Mobile Icon Generation"
Cohesion: 0.15
Nodes (17): androidRes, brandedSquare(), generateMobileIcons(), iosAssets, logo, root, splash(), androidPlugins (+9 more)

### Community 84 - "Kindle Firmware Quirks"
Cohesion: 0.19
Nodes (17): KINDLE_FIRMWARE_PROFILES, KindleFirmwareFamily, KindleFirmwareProfile, resolveKindleFirmwareProfile(), SAFE_RASTER_TYPES, appendManifestProperty(), buildCoverThumbnail(), convertImageForKindle() (+9 more)

### Community 85 - "AZW3 Resources and KF8 CSS"
Cohesion: 0.19
Nodes (19): buildImageResources(), buildKf8Css(), buildKf8HtmlParts(), collectInternalTargetsFromChunk(), decodeUtf8(), dirname(), encodeBase32(), hrefPath() (+11 more)

### Community 86 - "EPUB Packaging"
Cohesion: 0.22
Nodes (16): EpubChapterFile, normalizeIdentifier(), packageEpub(), renderContainerXml(), renderOpf(), renderToc(), isParagraph(), paragraphText() (+8 more)

### Community 87 - "Document File Metadata Index"
Cohesion: 0.18
Nodes (11): getFileMtime(), getFileName(), getFolderPath(), createSqliteCategoryRepository(), createSqliteDocumentFileRepository(), createSqliteDocumentMetadataRepository(), METADATA_FIELDS, DocumentSearchIndex (+3 more)

### Community 89 - "Mobile Error and Confirm UI"
Cohesion: 0.14
Nodes (10): react-dom, queryClient, Choice, ChoiceContext, Confirm, ConfirmContext, MobileConfirmProvider(), MobileErrorBoundary (+2 more)

### Community 90 - "Skeleton Components"
Cohesion: 0.26
Nodes (9): Skeleton(), SkeletonProps, HeatmapSkeleton(), RankingTableSkeleton(), StatCardSkeleton(), TableSkeleton(), useGetReadings(), formatDate() (+1 more)

### Community 91 - "Thumbnail Storage"
Cohesion: 0.21
Nodes (16): CoverSpec, coverSpecs, escapeXml(), extensionForMime(), getCoverSvg(), getThumbnailPath(), hydrateMobileBookThumbnails(), motifMarkup() (+8 more)

### Community 92 - "TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+7 more)

### Community 93 - "Annotation Repository"
Cohesion: 0.23
Nodes (11): AnnotationRepository, ensureAnnotationSchema(), SqliteDatabase, RelatedPagesStrip(), RelatedPagesStripProps, EMPTY_GRAPH, AnnotatedPage, AnnotationResult (+3 more)

### Community 94 - "Habit Validation"
Cohesion: 0.39
Nodes (10): validatedHabit(), validatedUpdates(), dateKey(), IpcValidationError, nonEmptyString(), nullableString(), positiveInteger(), positiveIntegerArray() (+2 more)

### Community 95 - "Processing Worker Pool"
Cohesion: 0.26
Nodes (3): ProcessingWorkerPool, WorkerTaskError, WorkerTaskKind

### Community 96 - "Mobile APK Manifest Script"
Cohesion: 0.14
Nodes (9): apkBytes, apkPath, artifactDir, manifest, manifestPath, packageJson, root, sha256 (+1 more)

### Community 97 - "PDF Noise and Line Analysis"
Cohesion: 0.26
Nodes (12): textSimilarity(), buildNoiseModel(), isPageNumber(), NoiseModel, NoiseSignature, normalizeNoiseText(), removeNoiseLines(), scoreNoise() (+4 more)

### Community 98 - "Kindle Send Panel"
Cohesion: 0.19
Nodes (13): CONVERTIBLE_TO_AZW3, DIRECT_KINDLE_FORMATS, getApi(), getBookFormat(), itemStatusLabel(), KindleSendApi, KindleSendDevice, KindleSendPanel() (+5 more)

### Community 99 - "Reading State Persistence"
Cohesion: 0.27
Nodes (13): DEFAULT_READING_STATE, getAnnotationPositionScore(), getLocalStorageKey(), getReadingPositionScore(), hasMeaningfulChange(), hasUsefulReadingPosition(), LocalReadingStateRecord, normalizeNumber() (+5 more)

### Community 100 - "Mobile Release Docs"
Cohesion: 0.15
Nodes (11): Dual Signed Android APK Build, Mobile OTA Bundle Updates, Android Application ID and Signing Continuity, Native App Icon Identity Fix, Electron PDF Reader Smoke Test, Android versionCode Encoding from SemVer, Release Secrets and Signing Keys, Electron Updater Manifests (+3 more)

### Community 101 - "Language Storage and JsonTree"
Cohesion: 0.22
Nodes (10): @testing-library/jest-dom, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, NAMESPACE_KEYS, resources, getStorage(), readStoredLanguage(), writeStoredLanguage() (+2 more)

### Community 102 - "Electron Import Verification"
Cohesion: 0.15
Nodes (12): builtinNames, electronRuntimeModules, extensions, files, filesIn(), missing, packageJson, packageNameFor() (+4 more)

### Community 103 - "i18n Language Config"
Cohesion: 0.24
Nodes (11): DEFAULT_NAMESPACE, isSupportedLanguage(), LanguageDefinition, SUPPORTED_LANGUAGES, SupportedLanguageCode, detectLanguage(), getPreferredLanguages(), LanguageDetectionInput (+3 more)

### Community 104 - "Bounding Box Math"
Cohesion: 0.31
Nodes (12): combineBBoxes(), percentile(), weightedAverage(), buildParagraphs(), createParagraph(), endsStrongly(), isAllCapsLine(), isDialogueStart() (+4 more)

### Community 105 - "Font Size Scoring"
Cohesion: 0.35
Nodes (12): clamp(), centerScore(), fontSizeScoreForHeading(), isChapterText(), isListText(), paragraphToBlock(), scoreBlockquote(), scoreFootnote() (+4 more)

### Community 106 - "Viewer Core Text Selection"
Cohesion: 0.19
Nodes (13): TextSelectionPayload, WordInteractionPayload, HIGHLIGHT_COLORS, clampProgress(), ContinuousManagerLike, EpubRelocatedLocation, EpubRequest, LyceumDocument (+5 more)

### Community 107 - "Concept Link Picker"
Cohesion: 0.24
Nodes (9): ACCENTS, buildRelationCounts(), conceptSearchText(), filterAndSortConcepts(), LINK_PAGE_SIZE, parseHighlightRects(), sortConcepts(), filterConceptsByChapter() (+1 more)

### Community 108 - "Architecture Highlights"
Cohesion: 0.21
Nodes (10): IPC error envelope { success, error }, TabContext (persistent tabs, rehydrate by hash, detached windows), Isolated PDF.js viewer theming via CMD_SET_THEME and --lyceum-* variables, Theme runtime flow (pre-paint -> boot.ts -> AppSettingsProvider), Token source of truth (palettes.ts, tokens.ts, appearance.ts, boot.ts), check-design-tokens.mjs static token checker, Tailwind v4 @theme inline token mapping, Pre-paint inline theme resolution script (index.html) (+2 more)

### Community 109 - "Navigation Bootstrap"
Cohesion: 0.26
Nodes (9): AUTH_ROUTES, NavigationBootstrapOptions, clearAllRouteStates(), clearLastRoute(), getLastRoute(), getRouteStateKey(), normalizePath(), PersistedState (+1 more)

### Community 110 - "Books In Folder Hook"
Cohesion: 0.27
Nodes (9): BooksInFolderInfo, emptyInfo(), ensureInfo(), folderAncestors(), getFolderBookInfo(), normalizeFolderKey(), useBooksInFolder(), PathStyle (+1 more)

### Community 111 - "Mobile Reading API"
Cohesion: 0.36
Nodes (9): createMobileUserProfile(), getMobileAuthErrorMessage(), getMobileSession(), getMobileSupabase(), mobileAuthStorage, readConfig(), subscribeMobileAuth(), validateMobileSession() (+1 more)

### Community 112 - "Concept List Filters"
Cohesion: 0.23
Nodes (12): CONCEPT_LIST_PAGE_SIZE, FilterScope, formatRelativeUpdatedAt(), paginate(), SortMode, ChapterRange, ConceptList(), ConceptListProps (+4 more)

### Community 113 - "Habit IPC Handlers"
Cohesion: 0.29
Nodes (3): registerHabitHandlers(), createSqliteHabitRepository(), HabitRepository

### Community 114 - "Zoom and Platform Handlers"
Cohesion: 0.21
Nodes (3): clampZoom(), registerPlatformHandlers(), updateZoom()

### Community 115 - "Icon Generation Scripts"
Cohesion: 0.20
Nodes (9): sharp, generateIcon(), generateIcons(), iconFiles, outputDir, projectRoot, sizes, drawImageBlock() (+1 more)

### Community 116 - "CSS Import Inlining"
Cohesion: 0.24
Nodes (10): postcss, CssSanitizeOptions, importHref(), inlineImports(), renderKindleDefaultCss(), rewriteUrls(), SAFE_DISPLAY_VALUES, SAFE_PROPERTIES (+2 more)

### Community 117 - "Vite Build Chunks"
Cohesion: 0.20
Nodes (6): @tailwindcss/vite, vite, vite-plugin-electron, @vitejs/plugin-react, browserEvents, optionalCanvasStub

### Community 118 - "Architecture Import Check"
Cohesion: 0.18
Nodes (10): allHandlerChannels, envDeclaration, failures, handlerChannels, invokedChannels, preload, read(), root (+2 more)

### Community 120 - "Chapter Progress Storage"
Cohesion: 0.33
Nodes (10): ChapterProgressState, getChapterStorageKey(), loadChapterState(), saveChapterState(), buildTree(), collectNodeAndDescendantIds(), countNodes(), countRead() (+2 more)

### Community 121 - "Adm-Zip Type Declarations"
Cohesion: 0.17
Nodes (3): adm-zip, AdmZip, ZipEntry

### Community 122 - "Migration Tests"
Cohesion: 0.22
Nodes (8): addColumnIfMissing(), getSqliteSchemaVersion(), getTableColumns(), quoteIdentifier(), tableExists(), createAncillaryTables(), databases, migrateLikeApplication()

### Community 123 - "Window Handler Tests"
Cohesion: 0.27
Nodes (7): DetachedReadingWindowData, registerWindowHandlers(), createHarness(), Handler, WindowControls, WindowHandlerDependencies, electron

### Community 124 - "PDF Buffer Cache"
Cohesion: 0.24
Nodes (6): cachePdfBuffer(), getCachedPdfBuffer(), MAX_CACHED_PDF_BUFFERS, MAX_CACHED_PDF_BYTES, PdfBufferCache, pdfBuffers

### Community 125 - "PDF Reader Type Guards"
Cohesion: 0.38
Nodes (10): isBookLandmark(), isFiniteNumber(), isNavigateState(), isOutlineNode(), isPdfSelectionPayload(), isPdfSelectionRect(), isPdfViewState(), isRecord() (+2 more)

### Community 126 - "Navigation Guards"
Cohesion: 0.24
Nodes (6): NavigateState, createNavigationGuard(), NavigationDecision, NavigationGuard, NavigationIntent, NavigationMode

### Community 127 - "AZW3 Build Records"
Cohesion: 0.18
Nodes (11): buildAzw3(), buildDatpRecord(), buildFdstRecord(), buildKf8Section(), buildTextRecordsKf8(), compressPalmDocRecord(), encodeBackwardVwi(), encodeTrailingData() (+3 more)

### Community 128 - "PDF Column Layout"
Cohesion: 0.33
Nodes (10): applyReadingOrder(), buildColumnRegion(), clusterCenters(), detectColumns(), detectFullWidthLines(), lineBelongsToColumn(), nearestColumn(), orderLinesForPage() (+2 more)

### Community 129 - "Annotation Empty State"
Cohesion: 0.35
Nodes (8): AnnotationEmptyState(), clampConceptPage(), findDuplicateTitle(), normalizeTitle(), ConceptEditor(), CurrentPageConcepts(), CurrentPageConceptsProps, relationKey()

### Community 130 - "PDF.js Viewer"
Cohesion: 0.22
Nodes (9): postToPdfViewer(), PdfJsViewer(), PdfJsViewerProps, toReadingState(), Viewer(), ViewerProps, SessionPageInfo, useSessionTracker() (+1 more)

### Community 131 - "KFX Previewer Docs"
Cohesion: 0.22
Nodes (9): Intermediate EPUB for Kindle Previewer, KFX Conversion via Kindle Previewer, KFX Structural Validation and CONT Signature, kfxlib Python Assembly Bridge, Semantic XHTML and EPUB 3 Packaging, Font Histogram and Style Detection, Layout Columns Reading Order and TOC Detection, PDF to EPUB Remaining Gaps (OCR Tables Images) (+1 more)

### Community 133 - "Word Index Repository"
Cohesion: 0.20
Nodes (3): createSqliteWordIndexRepository(), WordIndexEntry, WordIndexRepository

### Community 134 - "PDF Font Analysis"
Cohesion: 0.31
Nodes (9): buildFontProfile(), classifyTokenStyle(), extractFontBaseName(), FontGroupStats, FontProfile, inferStyleFromName(), StyleClassification, parsePdfToPages() (+1 more)

### Community 135 - "Electron Main and Preload Bridge"
Cohesion: 0.31
Nodes (7): Electron main process (electron/main.ts), Preload context bridge (window.api), ADR 001: Modular monolith with explicit ports, window.api as the single bridge contract, Architecture dependency check (no page imports in features, no duplicate IPC), Runtime shape: renderer -> preload -> main -> SQLite/filesystem, FOUC prevention at HTML, boot module and Electron window levels

### Community 136 - "SQLite Database Architecture"
Cohesion: 0.28
Nodes (8): Local SQLite database (better-sqlite3), SQLite document-query adapter (filtering, FTS, sorting, pagination), SQLite schema startup sequence (bootstrap to post-migration), Synced vs unsynced library documents, Fingerprint-keyed local PDF bookmarks, Document sync flow (move/copy into managed library, mark synced), Local SQLite data model (documents, paths, reader state, habits, word indexes), Library workspace (folders, collections, cover grid, metadata)

### Community 137 - "Reading Stats and Supabase"
Cohesion: 0.25
Nodes (8): Reading statistics, heatmaps and ranking, Reading entry flow (renderer -> Supabase -> cache invalidation), Supabase account and shared data store, FEATURES.md feature and bug backlog (Portuguese), Cross-app file drag, copy and cut for book files, Sidebar keyboard hotkeys (Esc focus, Up/Down, 1-7 routes), Redesigned mobile Select/Input components, Custom zoom-aware PDF text selection

### Community 138 - "File Dialog Tests"
Cohesion: 0.33
Nodes (5): FileDialogHandlerDependencies, ReadableDocument, registerFileDialogHandlers(), createHarness(), Handler

### Community 139 - "Strict TypeScript Config"
Cohesion: 0.22
Nodes (8): ./tsconfig.json, compilerOptions, noImplicitOverride, noUncheckedIndexedAccess, strict, exclude, extends, include

### Community 140 - "External Book Search"
Cohesion: 0.36
Nodes (7): calculateSimilarity(), ExternalBook, ExternalBookResult, levenshteinDistance(), normalizeForComparison(), searchAllBooks(), searchOpenLibrary()

### Community 141 - "Result and Domain Errors"
Cohesion: 0.33
Nodes (6): DomainError, DomainException, failure(), Result, success(), unwrap()

### Community 142 - "AZW3 Record Assertions"
Cohesion: 0.22
Nodes (9): assertRecordMagic(), buildAzw3FromKf8(), buildEofRecord(), buildFcisRecord(), buildFlisRecord(), buildPdb(), clampPdbName(), hasResourceProperty() (+1 more)

### Community 143 - "Library Filter Bar"
Cohesion: 0.31
Nodes (8): allFileTypes, fileTypeLabels, FileTypeSelect(), FilterBar(), FilterBarProps, SearchInput(), sortLabelKeys, SortSelect()

### Community 144 - "Test Mocks"
Cohesion: 0.25
Nodes (7): createMockSupabaseClient(), mockRankingUser, mockReading, mockReadingStats, mockSupabaseProfile, mockSupabaseUser, setupSupabaseMock()

### Community 145 - "Node TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 146 - "Desktop Dev and IPC Docs"
Cohesion: 0.29
Nodes (6): Desktop Dev Command, Adding a Library IPC Operation, Local SQLite Document Store, window.api Preload Bridge, Library Folder Operations, Synced vs Unsynced Library Documents

### Community 147 - "Development Setup Docs"
Cohesion: 0.25
Nodes (8): Development Environment Setup, Dashboard Area, GitHub Pages Documentation Publishing, Library Area, Lyceum Product Overview, Tabbed Reader Area, Supabase Auth and Cloud Data, Reader Tab Persistence

### Community 148 - "Canvas PDF Rendering"
Cohesion: 0.36
Nodes (5): loadCanvas(), loadPdfJs(), RenderedPdfPage, RenderPdfPageOptions, renderPdfPageToPng()

### Community 149 - "Electron Worker Verification"
Cohesion: 0.25
Nodes (6): fixture, fixturePath, outputPath, packageRoot, worker, workerPath

### Community 150 - "PDF.js Asset Verification"
Cohesion: 0.25
Nodes (7): assetRoot, builds, html, modules, root, versions, viewer

### Community 151 - "Conversion and Dictionary Docs"
Cohesion: 0.33
Nodes (7): Local format conversion pipeline (src/lib/lyceum), Built-in dictionary subsystem (manager, storage, lemmatizer, lookup), Kindle Send / USB e-reader sideload, Lyceum (cross-platform ebook manager and reader), Built-in offline dictionary and vocabulary extraction, All-formats-to-all-formats local conversion, Send to Kindle feature

### Community 152 - "Library Reader Docs"
Cohesion: 0.29
Nodes (6): Reader State Keyed by File Hash, Mobile App-Managed Library Storage, Mobile PDF EPUB TXT Readers, Mobile Library Quality Gate, Mobile Source Folder Snapshots, Mobile UI Improvement Plan Scope

### Community 153 - "PDF.js Asset Path"
Cohesion: 0.38
Nodes (4): isWithin(), resolvePdfjsAssetPath(), publicRoot, sourceOverlayRoot

### Community 154 - "Dictionary Download Script"
Cohesion: 0.33
Nodes (5): DICTIONARIES, __dirname, downloadFile(), __filename, main()

### Community 155 - "AZW3 TBS Indexing"
Cohesion: 0.29
Nodes (7): buildTbsForTextRecords(), calculateTbsRecords(), collectTbsIndexingData(), encodeTbsStrandsAsSequences(), fillTbsEntry(), populateTbsStrand(), separateTbsStrands()

### Community 157 - "Chapter Sidebar"
Cohesion: 0.48
Nodes (6): ChapterRow(), ChapterSidebar(), ChapterSidebarProps, loadSidebarWidth(), saveSidebarWidth(), ChapterTracker

### Community 158 - "Concept Graph Docs"
Cohesion: 0.40
Nodes (6): Annotations and concept graph (Sigma/Graphology), Two-job render limit with 32-entry bitmap cache, BookEdge spatial page edge in the desktop PDF reader, Riffle preview modal (6/8/12 pages, Close Look), BookEdge validation suite (unit, Electron smoke, browser check), Contextual + Concept button on text selection

### Community 159 - "Typed PDF Contract Docs"
Cohesion: 0.40
Nodes (5): Typed PDF Reader Contract, lyceum-core.mjs Bundle, Versioned postMessage Frame Transport, Outline Load After document-ready, lyceum-pdf and lyceum-pdfjs Protocols

### Community 160 - "Security Policy Tests"
Cohesion: 0.60
Nodes (4): contentSecurityPolicy(), installContentSecurityPolicy(), SHARED_POLICY, shouldBypassContentSecurityPolicy()

### Community 161 - "Vocabulary Service"
Cohesion: 0.47
Nodes (4): extractVocabularyFromEpub(), normalizeWord(), STOPWORDS, stripHtml()

### Community 162 - "Dictionary Extraction Script"
Cohesion: 0.40
Nodes (5): DICTIONARIES, __dirname, __filename, main(), run7z()

### Community 164 - "API Type Declarations"
Cohesion: 0.33
Nodes (5): DictionaryInfo, LookupResult, VocabularyExtractResult, VocabularyStats, WordCountResult

### Community 165 - "Release Pipeline Docs"
Cohesion: 0.50
Nodes (4): electron-after-pack.cjs post-pack validation hook, Capacitor mobile app (Android release, iOS scaffold), Unified GitHub Actions release pipeline (main.yml), Lyceum Mobile HTML entry (pt-BR, viewport-fit=cover)

### Community 166 - "Dev Workflow Docs"
Cohesion: 0.50
Nodes (4): TanStack Query Cache Refresh After Mutations, Register Reading Area, Mobile Component and Token Base, Mobile Reading Entry Redesign

### Community 171 - "Package Author Metadata"
Cohesion: 0.67
Nodes (3): author, email, name

## Knowledge Gaps
- **56 isolated node(s):** `@capacitor/android`, `@capacitor/ios`, `@codemirror/autocomplete`, `@codemirror/commands`, `@codemirror/lang-markdown` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `SQLite Schema and Migrations` to `Shared Library Data Model`, `Kindle Send Pipeline`, `Kindle Conversion and Dictionaries`, `Library File Operations`, `Settings and Update UI`, `Library Context and Folders`, `EPUB Parsing and Validation`, `Users and Ranking Periods`, `Tab Bar and Buffer Cache`, `Reading and Social Categories`, `File Dialog Tests`, `Auth and Profile UI`, `External Book Search`, `Result and Domain Errors`, `App Settings and Appearance`, `Statistics and Charts`, `Book Search and Backup`, `Native Build Scripts`, `Conversion API Profiles`, `Test Mocks`, `Mobile Library Screens`, `App Updater and Releases`, `Rankings and Social Fetch`, `PDF.js Asset Path`, `Metadata Search and Save`, `Library Folder Drag and Drop`, `EPUB Content Blocks`, `Dictionary Language Learning`, `Security Policy Tests`, `Package Manifest`, `Section Nodes and Clusters`, `Stat Card Component`, `Import and Thumbnail Dialogs`, `Mobile Backup and Annotations`, `Book Grid and List Layouts`, `Logo Component`, `Library Query Builder`, `Mobile Dashboard Charts`, `Mobile Release Workflow Test`, `PDF Viewer Lifecycle Test`, `Supabase Config Test`, `PDF Reader Core Contract`, `Desktop Release Resolver`, `Thumbnail Generation Helpers`, `Concept Graph Editor`, `Folder Breadcrumb Navigation`, `Backup IPC Tests`, `Event Bus Helpers`, `Annotation Repository Tests`, `PDF Selection and Annotations`, `Mobile Error and Confirm UI`, `Habit Validation`, `Mobile APK Manifest Script`, `PDF Noise and Line Analysis`, `Kindle Send Panel`, `Language Storage and JsonTree`, `Concept Link Picker`, `Navigation Bootstrap`, `Books In Folder Hook`, `Mobile Reading API`, `Zoom and Platform Handlers`, `CSS Import Inlining`, `Migration Tests`, `Window Handler Tests`, `PDF Buffer Cache`, `PDF Reader Type Guards`, `Navigation Guards`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **What connects `@capacitor/android`, `@capacitor/ios`, `@codemirror/autocomplete` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Library Data Model` be split into smaller, more focused modules?**
  _Cohesion score 0.03428515928515929 - nodes in this community are weakly interconnected._
- **Why does `react` connect `i18n Select and Translate` to `Annotation Empty State`, `PDF.js Viewer`, `Settings and Update UI`, `Library Context and Folders`, `Users and Ranking Periods`, `Tab Bar and Buffer Cache`, `Reading and Social Categories`, `Auth and Profile UI`, `App Settings and Appearance`, `Statistics and Charts`, `Book Search and Backup`, `Library Filter Bar`, `Conversion API Profiles`, `Reading Status Board`, `EPUB.js Reader Pane`, `Mobile Library Screens`, `App Updater and Releases`, `Rankings and Social Fetch`, `Metadata Search and Save`, `Library Folder Drag and Drop`, `Chapter Sidebar`, `Package Manifest`, `Mobile App Library Views`, `Import and Thumbnail Dialogs`, `Habit Tracker Page`, `Mobile Backup and Annotations`, `Mobile PDF Pane`, `Book Grid and List Layouts`, `Book Data Hook`, `Library Query Builder`, `Mobile Dashboard Charts`, `PDF Reader Core Contract`, `Vocabulary Panel`, `Concept Graph Editor`, `Mobile Book Import Bridge`, `EPUB Table of Contents`, `Reader Control Settings`, `Folder Breadcrumb Navigation`, `Reader Toolbar`, `Form Draft and Validation`, `Reading Status and Book Cards`, `Mobile Account Gate`, `PDF Selection and Annotations`, `Mobile Error and Confirm UI`, `Skeleton Components`, `Annotation Repository`, `Kindle Send Panel`, `Reading State Persistence`, `i18n Language Config`, `Viewer Core Text Selection`, `Concept Link Picker`, `Navigation Bootstrap`, `Books In Folder Hook`, `Mobile Reading API`, `Concept List Filters`, `Chapter Progress Storage`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `Kindle Send Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.027187136358827885 - nodes in this community are weakly interconnected._
- **Why does `useTranslation()` connect `Settings and Update UI` to `Annotation Empty State`, `PDF.js Viewer`, `Library Context and Folders`, `Users and Ranking Periods`, `Tab Bar and Buffer Cache`, `Reading and Social Categories`, `Auth and Profile UI`, `Statistics and Charts`, `Library Filter Bar`, `Book Search and Backup`, `EPUB.js Reader Pane`, `Mobile Library Screens`, `Rankings and Social Fetch`, `Metadata Search and Save`, `Library Folder Drag and Drop`, `i18n Select and Translate`, `Chapter Sidebar`, `Mobile App Library Views`, `Import and Thumbnail Dialogs`, `Mobile Backup and Annotations`, `Mobile PDF Pane`, `Book Grid and List Layouts`, `Mobile Dashboard Charts`, `PDF Reader Core Contract`, `Vocabulary Panel`, `Mobile Leaderboard Screen`, `Concept Graph Editor`, `Mobile Book Import Bridge`, `EPUB Table of Contents`, `Reader Control Settings`, `Folder Breadcrumb Navigation`, `Reader Toolbar`, `Form Draft and Validation`, `Reading Status and Book Cards`, `Mobile Account Gate`, `PDF Selection and Annotations`, `Skeleton Components`, `Annotation Repository`, `Kindle Send Panel`, `Viewer Core Text Selection`, `Concept Link Picker`, `Concept List Filters`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Kindle Conversion and Dictionaries` be split into smaller, more focused modules?**
  _Cohesion score 0.04249084249084249 - nodes in this community are weakly interconnected._