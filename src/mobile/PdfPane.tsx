import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListTree,
  Loader2,
  Minus,
  Moon,
  MoreHorizontal,
  PanelRight,
  Plus,
  RotateCw,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";
import type {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "./PdfPane.css";
import {
  DEFAULT_PDF_READER_PREFERENCES,
  clampPdfValue,
  flattenPdfOutline,
  formatPdfFileSize,
  formatPdfProgress,
  getPdfStorageId,
  parsePdfReaderPreferences,
  parseStoredPdfBookmarks,
  type FlatPdfOutlineItem,
  type PdfOutlineItem,
  type PdfReaderLayout,
  type PdfReaderPreferences,
  type PdfReaderTheme,
} from "./pdfReaderModel";

interface PdfPaneProps {
  dataUrl?: string;
  title?: string;
  fileName?: string;
  fileSize?: number;
  currentPage: number;
  initialZoom?: number;
  onPageChange: (page: number) => void;
  onPageCountChange: (pageCount: number) => void;
  onZoomChange?: (zoom: number) => void;
  onClose?: () => void;
}

type NavigationTab = "outline" | "thumbnails" | "bookmarks";

interface PdfRuntime {
  pdf: PDFDocumentProxy | null;
  viewer: PDFViewer;
  eventBus: EventBus;
  linkService: PDFLinkService;
  findController: PDFFindController;
}

interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
}

interface FindStatus {
  current: number;
  total: number;
  state: number;
}

const PREFERENCES_KEY = "lyceum:pdf-reader:preferences:v2";
const FIND_PENDING = 3;
const FIND_NOT_FOUND = 1;

function dataUrlToUint8Array(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("O arquivo PDF armazenado e invalido.");
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!metadata.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(payload));
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  const chunkSize = 32_768;
  for (let offset = 0; offset < binary.length; offset += chunkSize) {
    const end = Math.min(binary.length, offset + chunkSize);
    for (let index = offset; index < end; index += 1) bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function readPreferences() {
  try {
    return parsePdfReaderPreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return DEFAULT_PDF_READER_PREFERENCES;
  }
}

function getFriendlyPdfError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/password/i.test(message)) return "A senha informada nao abriu este documento.";
  if (/invalid|malformed|format/i.test(message)) return "Este arquivo parece estar danificado ou nao e um PDF valido.";
  if (/missing pdf/i.test(message)) return "O arquivo PDF nao esta mais disponivel no aparelho.";
  if (/memory|allocation/i.test(message)) return "O documento e grande demais para a memoria disponivel neste aparelho.";
  return message || "Nao foi possivel abrir este PDF.";
}

function getFindLabel(status: FindStatus, query: string) {
  if (query.trim().length < 2) return "Digite pelo menos 2 caracteres";
  if (status.state === FIND_PENDING) return "Buscando no documento...";
  if (status.state === 0) return "Preparando busca...";
  if (status.state === FIND_NOT_FOUND || status.total === 0) return "Nenhum resultado";
  return `${status.current} de ${status.total}`;
}

export default function PdfPane({
  dataUrl,
  title,
  fileName,
  fileSize,
  currentPage,
  initialZoom = 1,
  onPageChange,
  onPageCountChange,
  onZoomChange,
  onClose,
}: PdfPaneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewerElementRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<PdfRuntime | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const zoomSaveTimerRef = useRef<number | undefined>(undefined);
  const passwordCallbackRef = useRef<((password: string) => void) | null>(null);
  const layoutInitializedRef = useRef(false);
  const initialPageRef = useRef(Math.max(1, currentPage || 1));
  const onPageChangeRef = useRef(onPageChange);
  const onPageCountChangeRef = useRef(onPageCountChange);
  const onZoomChangeRef = useRef(onZoomChange);

  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(Math.max(1, currentPage || 1));
  const [pageLabels, setPageLabels] = useState<string[] | null>(null);
  const [scale, setScale] = useState(clampPdfValue(initialZoom || 1, 0.5, 5));
  const [rotation, setRotation] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationTab, setNavigationTab] = useState<NavigationTab>("outline");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [findStatus, setFindStatus] = useState<FindStatus>({ current: 0, total: 0, state: 0 });
  const [outline, setOutline] = useState<FlatPdfOutlineItem[]>([]);
  const [metadata, setMetadata] = useState<PdfMetadata>({});
  const [fingerprint, setFingerprint] = useState("");
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [preferences, setPreferences] = useState<PdfReaderPreferences>(readPreferences);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState(String(pageNumber));
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const documentTitle = metadata.title?.trim() || title?.trim() || fileName?.trim() || "Documento PDF";
  const progress = formatPdfProgress(pageNumber, pageCount);
  const currentLabel = pageLabels?.[pageNumber - 1] || String(pageNumber);
  const storageId = getPdfStorageId(fingerprint, `${fileName || title || "document"}-${fileSize || dataUrl?.length || 0}`);
  const isBookmarked = bookmarks.includes(pageNumber);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    onPageCountChangeRef.current = onPageCountChange;
    onZoomChangeRef.current = onZoomChange;
  }, [onPageChange, onPageCountChange, onZoomChange]);

  const scheduleControlsHide = useCallback((delay = 4200) => {
    window.clearTimeout(controlsTimerRef.current);
    if (navigationOpen || settingsOpen || searchOpen || jumpOpen || passwordOpen) return;
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), delay);
  }, [jumpOpen, navigationOpen, passwordOpen, searchOpen, settingsOpen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (controlsVisible) scheduleControlsHide();
    return () => window.clearTimeout(controlsTimerRef.current);
  }, [controlsVisible, scheduleControlsHide]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Reading must remain available when the WebView denies storage.
    }
  }, [preferences]);

  useEffect(() => {
    if (!pageCount) return;
    try {
      setBookmarks(parseStoredPdfBookmarks(localStorage.getItem(`lyceum:pdf-reader:bookmarks:${storageId}`), pageCount));
    } catch {
      setBookmarks([]);
    }
  }, [pageCount, storageId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.viewer || !pageCount) return;
    const nextPage = clampPdfValue(currentPage || 1, 1, pageCount);
    if (Math.abs(nextPage - runtime.viewer.currentPageNumber) > 1) runtime.viewer.currentPageNumber = nextPage;
  }, [currentPage, pageCount]);

  useEffect(() => {
    let disposed = false;
    let loadedPdf: PDFDocumentProxy | undefined;
    const abortController = new AbortController();
    abortRef.current?.abort();
    abortRef.current = abortController;

    async function loadDocument() {
      if (!dataUrl || !viewportRef.current || !viewerElementRef.current) return;
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);
      setPageCount(0);
      setOutline([]);
      setMetadata({});
      setPageLabels(null);
      setFindStatus({ current: 0, total: 0, state: 0 });
      layoutInitializedRef.current = false;

      try {
        const [pdfjs, viewerModule] = await Promise.all([
          import("pdfjs-dist/build/pdf.mjs"),
          import("pdfjs-dist/web/pdf_viewer.mjs"),
        ]);
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const eventBus = new viewerModule.EventBus();
        const linkService = new viewerModule.PDFLinkService({
          eventBus,
          externalLinkTarget: viewerModule.LinkTarget.BLANK,
          externalLinkRel: "noopener noreferrer nofollow",
        });
        const findController = new viewerModule.PDFFindController({ eventBus, linkService, updateMatchesCountOnProgress: true });
        const viewerOptions = {
          container: viewportRef.current,
          viewer: viewerElementRef.current,
          eventBus,
          linkService,
          findController,
          textLayerMode: 1,
          annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS,
          annotationEditorMode: pdfjs.AnnotationEditorType.NONE,
          enablePermissions: true,
          enableHWA: true,
          supportsPinchToZoom: true,
          maxCanvasPixels: 24 * 1024 * 1024,
          abortSignal: abortController.signal,
        } as ConstructorParameters<typeof viewerModule.PDFViewer>[0] & { abortSignal: AbortSignal };
        const viewer = new viewerModule.PDFViewer(viewerOptions);
        linkService.setViewer(viewer);

        eventBus.on("pagechanging", ({ pageNumber: nextPage }: { pageNumber: number }) => {
          if (disposed) return;
          setPageNumber(nextPage);
          onPageChangeRef.current(nextPage);
        });
        eventBus.on("scalechanging", ({ scale: nextScale }: { scale: number }) => {
          if (disposed || !Number.isFinite(nextScale)) return;
          setScale(nextScale);
          window.clearTimeout(zoomSaveTimerRef.current);
          zoomSaveTimerRef.current = window.setTimeout(() => onZoomChangeRef.current?.(nextScale), 240);
        });
        eventBus.on("rotationchanging", ({ pagesRotation }: { pagesRotation: number }) => {
          if (!disposed) setRotation(pagesRotation);
        });
        eventBus.on("updatefindmatchescount", ({ matchesCount }: { matchesCount?: Partial<FindStatus> }) => {
          if (!disposed) setFindStatus((current) => ({ ...current, ...matchesCount }));
        });
        eventBus.on("updatefindcontrolstate", ({ state, matchesCount }: { state: number; matchesCount?: Partial<FindStatus> }) => {
          if (!disposed) setFindStatus({ state, current: matchesCount?.current || 0, total: matchesCount?.total || 0 });
        });

        runtimeRef.current = { pdf: null, viewer, eventBus, linkService, findController };
        const loadingTask = pdfjs.getDocument({
          data: dataUrlToUint8Array(dataUrl),
          isEvalSupported: false,
          enableXfa: true,
          useWorkerFetch: false,
        });
        loadingTaskRef.current = loadingTask;
        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (!disposed && total > 0) setLoadingProgress(clampPdfValue(Math.round((loaded / total) * 100), 2, 98));
        };
        loadingTask.onPassword = (callback: (value: string) => void, reason: number) => {
          passwordCallbackRef.current = callback;
          setPasswordError(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
          setPassword("");
          setPasswordOpen(true);
        };

        loadedPdf = await loadingTask.promise;
        if (disposed) {
          await loadedPdf.destroy();
          return;
        }
        runtimeRef.current = { pdf: loadedPdf, viewer, eventBus, linkService, findController };
        linkService.setDocument(loadedPdf);
        findController.setDocument(loadedPdf);

        eventBus.on("pagesinit", () => {
          if (disposed) return;
          viewer.scrollMode = preferences.layout === "page" ? viewerModule.ScrollMode.PAGE : viewerModule.ScrollMode.VERTICAL;
          viewer.currentScaleValue = initialZoom > 1.02 ? String(clampPdfValue(initialZoom, 0.5, 5)) : "page-width";
          viewer.currentPageNumber = clampPdfValue(initialPageRef.current, 1, loadedPdf.numPages);
          setIsLoading(false);
          scheduleControlsHide(5200);
        });
        viewer.setDocument(loadedPdf);

        const totalPages = loadedPdf.numPages;
        setPageCount(totalPages);
        setLoadingProgress(100);
        onPageCountChangeRef.current(totalPages);
        setFingerprint(loadedPdf.fingerprints?.[0] || "");

        const [rawOutline, labels, documentMetadata] = await Promise.all([
          loadedPdf.getOutline().catch(() => null),
          loadedPdf.getPageLabels().catch(() => null),
          loadedPdf.getMetadata().catch(() => null),
        ]);
        if (disposed) return;
        setOutline(flattenPdfOutline(rawOutline as unknown as PdfOutlineItem[] | null));
        setPageLabels(labels);
        const info = (documentMetadata?.info || {}) as Record<string, unknown>;
        setMetadata({
          title: typeof info.Title === "string" ? info.Title : undefined,
          author: typeof info.Author === "string" ? info.Author : undefined,
          subject: typeof info.Subject === "string" ? info.Subject : undefined,
          creator: typeof info.Creator === "string" ? info.Creator : undefined,
          producer: typeof info.Producer === "string" ? info.Producer : undefined,
        });
      } catch (loadError) {
        if (!disposed) {
          setError(getFriendlyPdfError(loadError));
          setIsLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      disposed = true;
      window.clearTimeout(zoomSaveTimerRef.current);
      abortController.abort();
      runtimeRef.current?.viewer?.setDocument?.(null);
      runtimeRef.current?.linkService?.setDocument?.(null);
      runtimeRef.current = null;
      loadingTaskRef.current?.destroy?.();
      loadingTaskRef.current = null;
      loadedPdf?.destroy?.();
    };
    // Preferences are applied separately and must not reload the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, retryToken]);

  useEffect(() => {
    const viewer = runtimeRef.current?.viewer;
    if (!viewer || !pageCount) return;
    if (!layoutInitializedRef.current) {
      layoutInitializedRef.current = true;
      return;
    }
    const preservedPage = viewer.currentPageNumber;
    viewer.scrollMode = preferences.layout === "page" ? 3 : 0;
    viewer.currentScaleValue = preferences.layout === "page" ? "page-fit" : "page-width";
    viewer.currentPageNumber = preservedPage;
  }, [pageCount, preferences.layout]);

  const goToPage = useCallback((page: number) => {
    const viewer = runtimeRef.current?.viewer;
    if (!viewer || pageCount < 1) return;
    const nextPage = clampPdfValue(Math.round(page), 1, pageCount);
    viewer.currentPageNumber = nextPage;
    setPageNumber(nextPage);
    onPageChangeRef.current(nextPage);
    setJumpValue(String(nextPage));
    showControls();
  }, [pageCount, showControls]);

  const changeZoom = useCallback((direction: -1 | 1) => {
    const viewer = runtimeRef.current?.viewer;
    if (!viewer) return;
    const factor = direction > 0 ? 1.2 : 1 / 1.2;
    viewer.currentScale = clampPdfValue(viewer.currentScale * factor, 0.5, 5);
    showControls();
  }, [showControls]);

  const fitDocument = useCallback(() => {
    const viewer = runtimeRef.current?.viewer;
    if (!viewer) return;
    viewer.currentScaleValue = preferences.layout === "page" ? "page-fit" : "page-width";
    showControls();
  }, [preferences.layout, showControls]);

  const rotateDocument = useCallback(() => {
    const viewer = runtimeRef.current?.viewer;
    if (!viewer) return;
    viewer.pagesRotation = (viewer.pagesRotation + 90) % 360;
    showControls();
  }, [showControls]);

  const dispatchFind = useCallback((findPrevious = false) => {
    const eventBus = runtimeRef.current?.eventBus;
    const searchQuery = query.trim();
    if (!eventBus || searchQuery.length < 2) return;
    setFindStatus((current) => ({ ...current, state: FIND_PENDING }));
    eventBus.dispatch("find", {
      source: rootRef.current,
      type: "again",
      query: searchQuery,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    });
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    if (query.trim().length < 2) {
      runtimeRef.current?.eventBus?.dispatch("findbarclose", { source: rootRef.current });
      setFindStatus({ current: 0, total: 0, state: 0 });
      return;
    }
    const timer = window.setTimeout(() => dispatchFind(false), 320);
    return () => window.clearTimeout(timer);
  }, [dispatchFind, query, searchOpen]);

  const closeSearch = useCallback(() => {
    runtimeRef.current?.eventBus?.dispatch("findbarclose", { source: rootRef.current });
    setSearchOpen(false);
    setFindStatus({ current: 0, total: 0, state: 0 });
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const toggleBookmark = useCallback(() => {
    setBookmarks((current) => {
      const next = current.includes(pageNumber)
        ? current.filter((page) => page !== pageNumber)
        : [...current, pageNumber].sort((left, right) => left - right);
      try {
        localStorage.setItem(`lyceum:pdf-reader:bookmarks:${storageId}`, JSON.stringify(next));
      } catch {
        // Keep the in-memory bookmark even if storage is unavailable.
      }
      return next;
    });
    showControls();
  }, [pageNumber, showControls, storageId]);

  const openOutlineDestination = useCallback((item: FlatPdfOutlineItem) => {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
    else if (item.dest) void runtimeRef.current?.linkService?.goToDestination(item.dest);
    setNavigationOpen(false);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const submitPassword = () => {
    const callback = passwordCallbackRef.current;
    if (!callback || !password) return;
    passwordCallbackRef.current = null;
    setPasswordOpen(false);
    callback(password);
  };

  const handleReaderTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, .textLayer, .annotationLayer")) return;
    if (window.getSelection()?.toString().trim()) return;
    setControlsVisible((visible) => !visible);
  };

  const closeOverlays = () => {
    if (navigationOpen) setNavigationOpen(false);
    if (settingsOpen) setSettingsOpen(false);
    if (jumpOpen) setJumpOpen(false);
  };

  const themeStyle = useMemo(() => ({
    "--pdf-reader-brightness": String(preferences.brightness / 100),
  } as React.CSSProperties), [preferences.brightness]);

  return (
    <div
      ref={rootRef}
      className="lyceum-pdf-reader relative isolate h-full min-h-[100dvh] overflow-hidden"
      data-controls={controlsVisible ? "visible" : "hidden"}
      data-theme={preferences.theme}
      style={themeStyle}
      onClick={handleReaderTap}
    >
      <div ref={viewportRef} className="lyceum-pdf-reader__viewport" aria-label={`Leitor de ${documentTitle}`}>
        <div ref={viewerElementRef} className="lyceum-pdf-reader__viewer pdfViewer" />
      </div>

      {isLoading && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-[#171c22] px-8">
          <div className="lyceum-pdf-reader__skeleton-page" />
          <div className="absolute inset-x-0 top-[42%] flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-black/70 px-5 py-4 text-center shadow-2xl backdrop-blur-xl">
              <p className="text-sm font-semibold text-white">Preparando documento</p>
              <p className="mt-1 text-xs text-slate-400">Texto, links e paginas estao sendo indexados</p>
              <div className="lyceum-pdf-reader__loading-track mt-4"><div className="lyceum-pdf-reader__loading-value" style={{ width: `${Math.max(5, loadingProgress)}%` }} /></div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#11161c] px-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-500/10 text-red-300"><FileText size={30} /></div>
          <h2 className="mt-5 text-xl font-semibold text-white">Nao foi possivel abrir</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{error}</p>
          <div className="mt-7 flex gap-3"><button className="h-11 rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-200" onClick={onClose} type="button">Voltar</button><button className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-emerald-950" onClick={() => setRetryToken((value) => value + 1)} type="button">Tentar novamente</button></div>
        </div>
      )}

      <header className="lyceum-pdf-reader__topbar" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-[58px] items-center gap-1 px-2">
          <button className="lyceum-pdf-reader__icon-button" onClick={onClose} type="button" aria-label="Voltar para a biblioteca"><ArrowLeft size={21} /></button>
          <div className="min-w-0 flex-1 px-2"><p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white">{documentTitle}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{metadata.author || `${pageCount || "-"} paginas${fileSize ? ` · ${formatPdfFileSize(fileSize)}` : ""}`}</p></div>
          <button className="lyceum-pdf-reader__icon-button" aria-pressed={isBookmarked} onClick={toggleBookmark} type="button" aria-label={isBookmarked ? "Remover marcador" : "Marcar pagina"}>{isBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}</button>
          <button className="lyceum-pdf-reader__icon-button" onClick={() => { setSettingsOpen(true); setControlsVisible(true); }} type="button" aria-label="Mais opcoes"><MoreHorizontal size={22} /></button>
        </div>
        {searchOpen && (
          <div className="border-t border-white/8 px-3 pb-3 pt-2">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3"><Search size={17} className="shrink-0 text-slate-400" /><input autoFocus className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" placeholder="Buscar no documento" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") dispatchFind(event.shiftKey); }} />{query && <button className="grid h-8 w-8 place-items-center text-slate-400" onClick={() => setQuery("")} type="button" aria-label="Limpar busca"><X size={16} /></button>}</div>
            <div className="mt-2 flex h-8 items-center justify-between pl-1 text-xs text-slate-400"><span>{getFindLabel(findStatus, query)}</span><div className="flex items-center gap-1">{findStatus.state === FIND_PENDING && <Loader2 size={15} className="mr-2 animate-spin" />}<button className="lyceum-pdf-reader__icon-button !h-8 !w-8 !basis-8" disabled={query.trim().length < 2} onClick={() => dispatchFind(true)} type="button" aria-label="Resultado anterior"><ChevronLeft size={17} /></button><button className="lyceum-pdf-reader__icon-button !h-8 !w-8 !basis-8" disabled={query.trim().length < 2} onClick={() => dispatchFind(false)} type="button" aria-label="Proximo resultado"><ChevronRight size={17} /></button><button className="ml-1 text-xs font-semibold text-emerald-400" onClick={closeSearch} type="button">Fechar</button></div></div>
          </div>
        )}
      </header>

      <footer className="lyceum-pdf-reader__bottom-bar" onClick={(event) => event.stopPropagation()}>
        <div className="px-3 pb-2 pt-3">
          <div className="flex items-center gap-3"><button className="min-w-[62px] rounded-lg py-1 text-left text-xs font-semibold text-slate-200" onClick={() => { setJumpValue(String(pageNumber)); setJumpOpen(true); }} type="button">{currentLabel} <span className="font-normal text-slate-500">/ {pageLabels?.[pageCount - 1] || pageCount || "-"}</span></button><input className="lyceum-pdf-reader__progress flex-1" aria-label="Navegar pelas paginas" max={Math.max(1, pageCount)} min={1} style={{ "--pdf-progress": `${progress}%` } as React.CSSProperties} type="range" value={pageNumber} onChange={(event) => goToPage(Number(event.target.value))} /><span className="w-9 text-right text-xs tabular-nums text-slate-400">{progress}%</span></div>
          <div className="mt-2 flex h-12 items-center justify-around">
            <button className="lyceum-pdf-reader__icon-button" onClick={() => { setNavigationTab(outline.length ? "outline" : "thumbnails"); setNavigationOpen(true); }} type="button" aria-label="Sumario e paginas"><PanelRight size={20} /></button>
            <button className="lyceum-pdf-reader__icon-button" aria-pressed={searchOpen} onClick={() => { if (searchOpen) closeSearch(); else { setSearchOpen(true); setControlsVisible(true); } }} type="button" aria-label="Buscar"><Search size={20} /></button>
            <button className="lyceum-pdf-reader__icon-button" onClick={() => changeZoom(-1)} type="button" aria-label="Diminuir zoom"><Minus size={20} /></button>
            <button className="min-w-[58px] rounded-xl px-2 py-2 text-center text-xs font-semibold tabular-nums text-slate-200 active:bg-white/10" onClick={fitDocument} type="button" aria-label="Ajustar pagina">{Math.round(scale * 100)}%</button>
            <button className="lyceum-pdf-reader__icon-button" onClick={() => changeZoom(1)} type="button" aria-label="Aumentar zoom"><Plus size={20} /></button>
            <button className="lyceum-pdf-reader__icon-button" onClick={() => { setSettingsOpen(true); setControlsVisible(true); }} type="button" aria-label="Aparencia e leitura"><Settings2 size={20} /></button>
          </div>
        </div>
      </footer>

      <button className="lyceum-pdf-reader__fab" onClick={(event) => { event.stopPropagation(); showControls(); }} type="button" aria-label="Mostrar controles"><span className="text-xs font-semibold tabular-nums">{pageNumber}</span></button>

      {(navigationOpen || settingsOpen || jumpOpen) && <button className="lyceum-pdf-reader__scrim" onClick={(event) => { event.stopPropagation(); closeOverlays(); }} type="button" aria-label="Fechar painel" />}

      {navigationOpen && (
        <aside className="lyceum-pdf-reader__sheet" onClick={(event) => event.stopPropagation()} aria-label="Navegacao do documento">
          <div className="flex h-16 items-center gap-2 border-b border-white/8 px-4"><div className="min-w-0 flex-1"><p className="text-base font-semibold">Navegar</p><p className="truncate text-xs text-slate-500">{documentTitle}</p></div><button className="lyceum-pdf-reader__icon-button" onClick={() => setNavigationOpen(false)} type="button" aria-label="Fechar"><X size={20} /></button></div>
          <div className="grid grid-cols-3 gap-1 border-b border-white/8 p-2">{([ ["outline", "Sumario", ListTree], ["thumbnails", "Paginas", BookOpen], ["bookmarks", "Marcadores", Bookmark] ] as const).map(([id, label, Icon]) => <button key={id} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold ${navigationTab === id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`} onClick={() => setNavigationTab(id)} type="button"><Icon size={16} />{label}</button>)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {navigationTab === "outline" && (outline.length ? <div className="space-y-0.5">{outline.map((item) => <button key={item.id} className="flex min-h-11 w-full items-center rounded-xl py-2 pr-3 text-left text-sm leading-5 text-slate-300 active:bg-white/8" style={{ paddingLeft: `${12 + Math.min(item.depth, 4) * 16}px` }} onClick={() => openOutlineDestination(item)} type="button">{item.depth > 0 && <span className="mr-2 h-1 w-1 shrink-0 rounded-full bg-slate-600" />}{item.title || "Secao sem titulo"}</button>)}</div> : <PanelEmpty icon={ListTree} title="Sem sumario" body="Este PDF nao inclui uma estrutura de capitulos. Use as miniaturas ou a busca para navegar." />)}
            {navigationTab === "thumbnails" && <div className="grid grid-cols-2 gap-x-3 gap-y-5 pb-5">{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} className={`rounded-lg border p-2 text-xs ${page === pageNumber ? "border-emerald-400 bg-emerald-500/10 text-emerald-300" : "border-transparent text-slate-500"}`} onClick={() => { goToPage(page); setNavigationOpen(false); }} type="button"><PdfThumbnail pdf={runtimeRef.current?.pdf} pageNumber={page} /><span className="mt-2 block">{pageLabels?.[page - 1] || page}</span></button>)}</div>}
            {navigationTab === "bookmarks" && (bookmarks.length ? <div className="space-y-2">{bookmarks.map((page) => <button key={page} className={`flex h-14 w-full items-center gap-3 rounded-xl border px-3 text-left ${page === pageNumber ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/8 bg-white/[0.03]"}`} onClick={() => { goToPage(page); setNavigationOpen(false); }} type="button"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300"><Bookmark size={16} /></span><span className="flex-1 text-sm text-slate-200">Pagina {pageLabels?.[page - 1] || page}</span><ChevronRight size={17} className="text-slate-600" /></button>)}</div> : <PanelEmpty icon={Bookmark} title="Nenhum marcador" body="Toque no marcador da barra superior para guardar paginas importantes." />)}
          </div>
        </aside>
      )}

      {settingsOpen && (
        <aside className="lyceum-pdf-reader__sheet lyceum-pdf-reader__sheet--bottom" onClick={(event) => event.stopPropagation()} aria-label="Aparencia do leitor">
          <div className="lyceum-pdf-reader__sheet-handle" />
          <div className="flex items-center px-5 pb-3 pt-2"><div className="flex-1"><p className="text-lg font-semibold">Aparencia e leitura</p><p className="text-xs text-slate-500">Ajustes salvos para os proximos PDFs</p></div><button className="lyceum-pdf-reader__icon-button" onClick={() => setSettingsOpen(false)} type="button" aria-label="Fechar"><X size={20} /></button></div>
          <div className="overflow-y-auto px-5 pb-6">
            <SettingLabel>Aparencia da pagina</SettingLabel>
            <div className="grid grid-cols-3 gap-2">{([ ["paper", "Papel", Sun, "bg-white text-slate-800"], ["sepia", "Sepia", BookOpen, "bg-[#e9dfc5] text-[#584b34]"], ["night", "Noite", Moon, "bg-[#17212b] text-slate-100"] ] as const).map(([id, label, Icon, preview]) => <button key={id} className={`relative rounded-2xl border p-2 text-left ${preferences.theme === id ? "border-emerald-400 bg-emerald-500/8" : "border-white/10 bg-white/[0.025]"}`} onClick={() => setPreferences((current) => ({ ...current, theme: id as PdfReaderTheme }))} type="button"><span className={`grid h-14 place-items-center rounded-xl ${preview}`}><Icon size={20} /></span><span className="mt-2 flex items-center justify-between px-1 text-xs font-semibold text-slate-300">{label}{preferences.theme === id && <Check size={14} className="text-emerald-400" />}</span></button>)}</div>
            <SettingLabel>Brilho do documento</SettingLabel>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3"><Moon size={16} className="text-slate-500" /><input className="lyceum-pdf-reader__progress flex-1" min={55} max={100} style={{ "--pdf-progress": `${((preferences.brightness - 55) / 45) * 100}%` } as React.CSSProperties} type="range" value={preferences.brightness} onChange={(event) => setPreferences((current) => ({ ...current, brightness: Number(event.target.value) }))} aria-label="Brilho" /><Sun size={17} className="text-slate-300" /><span className="w-9 text-right text-xs tabular-nums text-slate-400">{preferences.brightness}%</span></div>
            <SettingLabel>Fluxo de leitura</SettingLabel>
            <div className="grid grid-cols-2 gap-2"><LayoutButton active={preferences.layout === "continuous"} icon={ListTree} label="Continuo" detail="Role entre paginas" onClick={() => setPreferences((current) => ({ ...current, layout: "continuous" as PdfReaderLayout }))} /><LayoutButton active={preferences.layout === "page"} icon={FileText} label="Uma pagina" detail="Foco e encaixe" onClick={() => setPreferences((current) => ({ ...current, layout: "page" as PdfReaderLayout }))} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><button className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-200" onClick={fitDocument} type="button"><BookOpen size={17} />Ajustar pagina</button><button className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-200" onClick={rotateDocument} type="button"><RotateCw size={17} />Girar {rotation}°</button></div>
            {(metadata.subject || metadata.creator || metadata.producer) && <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-5 text-slate-500"><p className="font-semibold text-slate-300">Sobre o arquivo</p>{metadata.subject && <p className="mt-2 text-slate-400">{metadata.subject}</p>}{metadata.creator && <p className="mt-2">Criado com {metadata.creator}</p>}{metadata.producer && metadata.producer !== metadata.creator && <p>PDF gerado por {metadata.producer}</p>}</div>}
          </div>
        </aside>
      )}

      {jumpOpen && <div className="absolute left-1/2 top-1/2 z-50 w-[min(88vw,330px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#11161c] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ir para pagina"><p className="text-lg font-semibold text-white">Ir para pagina</p><p className="mt-1 text-xs text-slate-500">Digite um numero entre 1 e {pageCount}</p><form className="mt-5" onSubmit={(event) => { event.preventDefault(); goToPage(Number(jumpValue)); setJumpOpen(false); }}><input autoFocus className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-center text-xl font-semibold tabular-nums text-white outline-none focus:border-emerald-500" inputMode="numeric" min={1} max={pageCount} type="number" value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} /><div className="mt-4 grid grid-cols-2 gap-2"><button className="h-11 rounded-xl border border-white/10 text-sm font-semibold text-slate-300" onClick={() => setJumpOpen(false)} type="button">Cancelar</button><button className="h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950" type="submit">Ir para pagina</button></div></form></div>}

      {passwordOpen && <div className="absolute inset-0 z-[60] grid place-items-center bg-[#0b0f13]/95 p-6" onClick={(event) => event.stopPropagation()}><form className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151b22] p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); submitPassword(); }}><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-300"><FileText size={23} /></div><h2 className="mt-5 text-xl font-semibold text-white">PDF protegido</h2><p className="mt-2 text-sm leading-6 text-slate-400">Digite a senha para abrir este documento. Ela sera usada somente nesta sessao.</p>{passwordError && <p className="mt-3 text-sm font-medium text-red-300">Senha incorreta. Tente novamente.</p>}<input autoFocus className="mt-5 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-emerald-500" placeholder="Senha do PDF" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><div className="mt-4 grid grid-cols-2 gap-2"><button className="h-11 rounded-xl border border-white/10 text-sm font-semibold text-slate-300" onClick={onClose} type="button">Cancelar</button><button className="h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950 disabled:opacity-40" disabled={!password} type="submit">Abrir</button></div></form></div>}
    </div>
  );
}

function PdfThumbnail({ pdf, pageNumber }: { pdf: PDFDocumentProxy | null | undefined; pageNumber: number }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "240px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pdf || !canvasRef.current) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    void pdf.getPage(pageNumber).then((page: PDFPageProxy) => {
      if (disposed || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 132 / base.width });
      const canvas = canvasRef.current;
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      renderTask = page.render({ canvasContext: context, viewport });
      return renderTask.promise;
    }).catch((thumbnailError: unknown) => {
      if (!disposed && !(thumbnailError instanceof Error && thumbnailError.name === "RenderingCancelledException")) setFailed(true);
    });
    return () => { disposed = true; renderTask?.cancel?.(); };
  }, [pageNumber, pdf, visible]);

  return <span ref={hostRef} className="lyceum-pdf-reader__thumbnail">{visible && !failed ? <canvas ref={canvasRef} /> : <span className="grid min-h-[126px] place-items-center text-slate-600"><FileText size={24} /></span>}</span>;
}

function PanelEmpty({ icon: Icon, title, body }: { icon: typeof Bookmark; title: string; body: string }) {
  return <div className="flex min-h-[50dvh] flex-col items-center justify-center px-7 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-slate-500"><Icon size={25} /></span><p className="mt-4 text-sm font-semibold text-slate-200">{title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{body}</p></div>;
}

function SettingLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">{children}</p>;
}

function LayoutButton({ active, icon: Icon, label, detail, onClick }: { active: boolean; icon: typeof FileText; label: string; detail: string; onClick: () => void }) {
  return <button className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 text-left ${active ? "border-emerald-400 bg-emerald-500/8" : "border-white/10 bg-white/[0.025]"}`} onClick={onClick} type="button"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.05] text-slate-400"}`}><Icon size={17} /></span><span><span className="block text-xs font-semibold text-slate-200">{label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{detail}</span></span></button>;
}
