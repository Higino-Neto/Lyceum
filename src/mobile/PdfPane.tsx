import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowLeft, ChevronDown, ChevronUp, Maximize2, RotateCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

interface PdfPaneProps {
  dataUrl?: string;
  currentPage: number;
  initialZoom?: number;
  onPageChange: (page: number) => void;
  onPageCountChange: (pageCount: number) => void;
  onZoomChange?: (zoom: number) => void;
  onClose?: () => void;
}

interface SearchHit {
  page: number;
  excerpt: string;
}

interface PdfPageProps {
  fitWidth: number;
  pageNumber: number;
  pdf: any;
  rotation: number;
  zoom: number;
}

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildExcerpt(text: string, query: string) {
  const index = normalizeText(text).indexOf(normalizeText(query));
  if (index < 0) return text.slice(0, 96);
  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + query.length + 54);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function touchDistance(touches: { length: number; [index: number]: { clientX: number; clientY: number } }) {
  if (touches.length < 2) return 0;
  const x = touches[0].clientX - touches[1].clientX;
  const y = touches[0].clientY - touches[1].clientY;
  return Math.hypot(x, y);
}

export default function PdfPane({
  dataUrl,
  currentPage,
  initialZoom = 1,
  onPageChange,
  onPageCountChange,
  onZoomChange,
  onClose,
}: PdfPaneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onPageCountChangeRef = useRef(onPageCountChange);
  const onZoomChangeRef = useRef(onZoomChange);
  const hideControlsTimerRef = useRef<number | undefined>(undefined);
  const searchRunRef = useRef(0);
  const pinchRef = useRef<{ distance: number; zoom: number } | undefined>(undefined);
  const initialScrollDoneRef = useRef(false);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fitWidth, setFitWidth] = useState(320);
  const [zoom, setZoom] = useState(() => clamp(initialZoom || 1, 1, 4));
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(0);

  const pageNumber = clamp(currentPage || 1, 1, Math.max(1, pageCount || 1));
  const estimatedPageHeight = Math.round(fitWidth * (rotation % 180 === 0 ? 1.42 : 0.78) * zoom) + 28;
  const progress = pageCount > 0 ? (pageNumber / pageCount) * 100 : 0;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedPageHeight,
    overscan: 3,
  });
  const virtualItems = virtualizer.getVirtualItems();

  const scheduleControlsHide = useCallback(() => {
    window.clearTimeout(hideControlsTimerRef.current);
    if (searchOpen || !controlsVisible) return;
    hideControlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3200);
  }, [controlsVisible, searchOpen]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    onPageCountChangeRef.current = onPageCountChange;
    onZoomChangeRef.current = onZoomChange;
  }, [onPageChange, onPageCountChange, onZoomChange]);

  useEffect(() => {
    scheduleControlsHide();
    return () => window.clearTimeout(hideControlsTimerRef.current);
  }, [controlsVisible, scheduleControlsHide, searchOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => onZoomChangeRef.current?.(zoom), 180);
    virtualizer.measure();
    return () => window.clearTimeout(timer);
  }, [estimatedPageHeight, virtualizer, zoom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) setFitWidth(Math.max(260, entry.contentRect.width - 24));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const visible = virtualItems.filter((item) => item.end >= (scrollRef.current?.scrollTop || 0));
    const center = visible[Math.floor(visible.length / 2)] || virtualItems[Math.floor(virtualItems.length / 2)];
    if (!center) return;
    const nextPage = center.index + 1;
    if (nextPage !== pageNumber) onPageChangeRef.current(nextPage);
  }, [pageNumber, virtualItems]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: any;
    initialScrollDoneRef.current = false;
    searchRunRef.current += 1;

    async function loadPdf() {
      if (!dataUrl) return;
      setIsLoading(true);
      setError(null);
      setPdf(null);
      setPageCount(0);
      setHits([]);
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument({
          data: dataUrlToUint8Array(dataUrl),
          useWorkerFetch: false,
          isEvalSupported: false,
        });
        const loadedPdf = await loadingTask.promise;
        if (disposed) {
          loadedPdf.destroy?.();
          return;
        }
        setPdf(loadedPdf);
        setPageCount(loadedPdf.numPages);
        onPageCountChangeRef.current(loadedPdf.numPages);
      } catch (loadError) {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : "Nao foi possivel abrir este PDF");
      } finally {
        if (!disposed) setIsLoading(false);
      }
    }

    void loadPdf();
    return () => {
      disposed = true;
      loadingTask?.destroy?.();
    };
  }, [dataUrl]);

  useEffect(() => {
    if (!pdf || pageCount < 1 || initialScrollDoneRef.current) return;
    initialScrollDoneRef.current = true;
    requestAnimationFrame(() => virtualizer.scrollToIndex(clamp(pageNumber, 1, pageCount) - 1, { align: "start" }));
  }, [pageCount, pageNumber, pdf, virtualizer]);

  const scrollToPage = useCallback((page: number) => {
    if (pageCount < 1) return;
    const targetPage = clamp(page, 1, pageCount);
    virtualizer.scrollToIndex(targetPage - 1, { align: "start" });
    onPageChangeRef.current(targetPage);
    scheduleControlsHide();
  }, [pageCount, scheduleControlsHide, virtualizer]);

  const cancelSearch = useCallback(() => {
    searchRunRef.current += 1;
    setIsSearching(false);
  }, []);

  const runSearch = async () => {
    const searchQuery = query.trim();
    if (!pdf || searchQuery.length < 2) return;
    const runId = searchRunRef.current + 1;
    searchRunRef.current = runId;
    setIsSearching(true);
    setHits([]);
    setActiveHitIndex(0);
    const nextHits: SearchHit[] = [];
    const normalizedQuery = normalizeText(searchQuery);

    try {
      for (let page = 1; page <= pageCount; page += 1) {
        if (searchRunRef.current !== runId) return;
        const pdfPage = await pdf.getPage(page);
        const textContent = await pdfPage.getTextContent();
        const text = textContent.items.map((item: any) => item.str || "").join(" ");
        if (normalizeText(text).includes(normalizedQuery)) {
          nextHits.push({ page, excerpt: buildExcerpt(text, searchQuery) });
          setHits([...nextHits]);
        }
        if (page % 4 === 0) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (searchRunRef.current === runId && nextHits[0]) scrollToPage(nextHits[0].page);
    } finally {
      if (searchRunRef.current === runId) setIsSearching(false);
    }
  };

  const goToHit = (index: number) => {
    if (!hits.length) return;
    const nextIndex = (index + hits.length) % hits.length;
    setActiveHitIndex(nextIndex);
    scrollToPage(hits[nextIndex].page);
  };

  const handleReaderTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection()?.toString().trim();
    if (selection || searchOpen) return;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds || event.clientY > bounds.top + bounds.height * 0.3) return;
    setControlsVisible((visible) => !visible);
  };

  return (
    <div
      ref={rootRef}
      className="relative isolate h-full min-h-[100dvh] overflow-hidden bg-[#151515]"
      onClick={handleReaderTap}
      onDoubleClick={() => setZoom((value) => value > 1.15 ? 1 : 2)}
      onTouchStart={(event) => {
        if (event.touches.length === 2) {
          pinchRef.current = { distance: touchDistance(event.touches), zoom };
          revealControls();
        }
      }}
      onTouchMove={(event) => {
        if (event.touches.length !== 2 || !pinchRef.current) return;
        event.preventDefault();
        const distance = touchDistance(event.touches);
        if (distance > 0) setZoom(clamp(pinchRef.current.zoom * (distance / pinchRef.current.distance), 1, 4));
      }}
      onTouchEnd={(event) => {
        if (event.touches.length < 2) pinchRef.current = undefined;
        scheduleControlsHide();
      }}
    >
      <div
        className={`absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-zinc-950/90 pt-[env(safe-area-inset-top)] shadow-xl backdrop-blur-xl transition duration-200 ${controlsVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={onClose} type="button" aria-label="Voltar para a biblioteca">
            <ArrowLeft size={19} />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={() => { cancelSearch(); setSearchOpen((value) => !value); }} type="button" aria-label="Buscar">
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-white">Pagina {pageNumber} de {Math.max(1, pageCount)}</p>
            <p className="text-[11px] text-zinc-400">{Math.round(zoom * 100)}% · toque duplo para ampliar</p>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={() => setZoom(1)} type="button" aria-label="Ajustar a largura">
            <Maximize2 size={18} />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={() => setRotation((value) => (value + 90) % 360)} type="button" aria-label="Girar pagina">
            <RotateCw size={18} />
          </button>
        </div>

        {searchOpen && (
          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                autoFocus
                className="h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm text-white outline-none ring-emerald-500 focus:ring-2"
                placeholder="Buscar neste PDF"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }}
              />
              <button className="rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={query.trim().length < 2} onClick={() => isSearching ? cancelSearch() : void runSearch()} type="button">
                {isSearching ? "Cancelar" : "Buscar"}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
              <span>{isSearching ? `Procurando... ${hits.length} encontrados` : hits.length ? `${activeHitIndex + 1} de ${hits.length}` : "Selecione e copie textos diretamente na pagina"}</span>
              <div className="flex gap-1">
                <button className="grid h-8 w-8 place-items-center rounded-full bg-white/10 disabled:opacity-30" disabled={!hits.length} onClick={() => goToHit(activeHitIndex - 1)} type="button" aria-label="Resultado anterior"><ChevronUp size={16} /></button>
                <button className="grid h-8 w-8 place-items-center rounded-full bg-white/10 disabled:opacity-30" disabled={!hits.length} onClick={() => goToHit(activeHitIndex + 1)} type="button" aria-label="Proximo resultado"><ChevronDown size={16} /></button>
              </div>
            </div>
            {hits[activeHitIndex] && <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-300">Pag. {hits[activeHitIndex].page}: {hits[activeHitIndex].excerpt}</p>}
          </div>
        )}
        <div className="h-0.5 bg-white/10"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div
        ref={scrollRef}
        className="h-full overflow-auto overscroll-contain bg-[#191919]"
        style={{ touchAction: "pan-x pan-y" }}
        onScroll={scheduleControlsHide}
      >
        {isLoading && <div className="sticky left-3 top-3 z-20 mx-auto w-fit rounded-full bg-black/75 px-4 py-2 text-sm text-zinc-200 backdrop-blur">Abrindo PDF...</div>}
        {error && <div className="absolute inset-0 z-20 grid place-items-center p-8 text-center text-sm leading-6 text-zinc-300">{error}</div>}
        <div className="relative min-w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualItems.map((item) => (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute left-0 top-0 min-w-full px-3 py-3"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <PdfPage fitWidth={fitWidth} pageNumber={item.index + 1} pdf={pdf} rotation={rotation} zoom={zoom} />
            </div>
          ))}
        </div>
      </div>

      {!controlsVisible && !searchOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] text-white/70 backdrop-blur">Toque no topo para controles</span>
        </div>
      )}
    </div>
  );
}

function PdfPage({ fitWidth, pageNumber, pdf, rotation, zoom }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const textLayerTaskRef = useRef<any>(null);
  const [pageSize, setPageSize] = useState({ width: fitWidth, height: Math.round(fitWidth * 1.42) });
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    async function renderPage() {
      if (!pdf || !canvasRef.current || !textLayerRef.current) return;
      renderTaskRef.current?.cancel?.();
      textLayerTaskRef.current?.cancel?.();
      setIsRendering(true);
      setError(null);

      try {
        const [page, pdfjs] = await Promise.all([pdf.getPage(pageNumber), import("pdfjs-dist/build/pdf.mjs")]);
        if (disposed) return;
        const baseViewport = page.getViewport({ scale: 1, rotation });
        const viewport = page.getViewport({ scale: clamp((fitWidth / baseViewport.width) * zoom, 0.5, 5), rotation });
        setPageSize({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, viewport.width, viewport.height);

        const textContainer = textLayerRef.current;
        textContainer.replaceChildren();
        textContainer.style.width = `${viewport.width}px`;
        textContainer.style.height = `${viewport.height}px`;
        textContainer.style.setProperty("--scale-factor", String(viewport.scale));

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        const textContent = await page.getTextContent();
        if (disposed) return;
        const textLayerTask = new pdfjs.TextLayer({ textContentSource: textContent, container: textContainer, viewport });
        textLayerTaskRef.current = textLayerTask;
        await Promise.all([renderTask.promise, textLayerTask.render()]);
      } catch (renderError) {
        if (!disposed && !(renderError instanceof Error && renderError.name === "RenderingCancelledException")) {
          setError(renderError instanceof Error ? renderError.message : "Falha ao renderizar pagina");
        }
      } finally {
        if (!disposed) setIsRendering(false);
      }
    }

    void renderPage();
    return () => {
      disposed = true;
      renderTaskRef.current?.cancel?.();
      textLayerTaskRef.current?.cancel?.();
    };
  }, [fitWidth, pageNumber, pdf, rotation, zoom]);

  return (
    <div className="mx-auto pb-2" style={{ width: pageSize.width }}>
      <div className="relative overflow-hidden bg-white shadow-2xl shadow-black/40" style={{ width: pageSize.width, height: pageSize.height }}>
        <canvas ref={canvasRef} className="block bg-white" />
        <div ref={textLayerRef} className="textLayer select-text" />
        {isRendering && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/70 text-xs text-zinc-500">Renderizando...</div>}
        {error && <div className="absolute inset-0 grid place-items-center bg-white p-4 text-center text-xs text-zinc-700">{error}</div>}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">{pageNumber}</p>
    </div>
  );
}
