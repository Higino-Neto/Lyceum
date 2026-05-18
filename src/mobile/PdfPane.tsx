import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

interface PdfPaneProps {
  dataUrl?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageCountChange: (pageCount: number) => void;
}

interface SearchHit {
  page: number;
  excerpt: string;
}

interface PdfPageCanvasProps {
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildExcerpt(text: string, query: string) {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);
  if (index < 0) return text.slice(0, 96);
  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + query.length + 54);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export default function PdfPane({
  dataUrl,
  currentPage,
  onPageChange,
  onPageCountChange,
}: PdfPaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onPageCountChangeRef = useRef(onPageCountChange);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fitWidth, setFitWidth] = useState(320);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(0);

  const pageNumber = clamp(currentPage || 1, 1, Math.max(1, pageCount || 1));
  const progress = pageCount > 0 ? Math.round((pageNumber / pageCount) * 100) : 0;
  const estimatedPageHeight = Math.round(fitWidth * (rotation % 180 === 0 ? 1.42 : 0.78) * zoom) + 44;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedPageHeight,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    onPageCountChangeRef.current = onPageCountChange;
  }, [onPageChange, onPageCountChange]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setFitWidth(Math.max(260, width - 24));
    });
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    virtualizer.measure();
  }, [estimatedPageHeight, rotation, virtualizer, zoom]);

  useEffect(() => {
    const center = virtualItems[Math.floor(virtualItems.length / 2)];
    if (!center) return;
    const nextPage = center.index + 1;
    if (nextPage !== pageNumber) onPageChangeRef.current(nextPage);
  }, [pageNumber, virtualItems]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: any;

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
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : "Nao foi possivel abrir este PDF");
      } finally {
        if (!disposed) setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      disposed = true;
      loadingTask?.destroy?.();
    };
  }, [dataUrl]);

  useEffect(() => {
    if (!pdf || pageCount < 1) return;
    virtualizer.scrollToIndex(clamp(pageNumber, 1, pageCount) - 1, { align: "start" });
  }, [pdf, pageCount]);

  const scrollToPage = useCallback((page: number) => {
    if (pageCount < 1) return;
    const targetPage = clamp(page, 1, pageCount);
    virtualizer.scrollToIndex(targetPage - 1, { align: "start" });
    onPageChangeRef.current(targetPage);
  }, [pageCount, virtualizer]);

  const setPageFromInput = (value: string) => {
    const nextPage = Number(value);
    if (Number.isFinite(nextPage)) scrollToPage(Math.round(nextPage));
  };

  const runSearch = async () => {
    const searchQuery = query.trim();
    if (!pdf || searchQuery.length < 2) {
      setHits([]);
      setActiveHitIndex(0);
      return;
    }

    setIsSearching(true);
    try {
      const nextHits: SearchHit[] = [];
      const normalizedQuery = normalizeText(searchQuery);
      for (let page = 1; page <= pageCount; page += 1) {
        const pdfPage = await pdf.getPage(page);
        const textContent = await pdfPage.getTextContent();
        const text = textContent.items.map((item: any) => item.str || "").join(" ");
        if (normalizeText(text).includes(normalizedQuery)) {
          nextHits.push({ page, excerpt: buildExcerpt(text, searchQuery) });
        }
      }
      setHits(nextHits);
      setActiveHitIndex(0);
      if (nextHits[0]) scrollToPage(nextHits[0].page);
    } finally {
      setIsSearching(false);
    }
  };

  const goToHit = (index: number) => {
    if (hits.length === 0) return;
    const nextIndex = (index + hits.length) % hits.length;
    setActiveHitIndex(nextIndex);
    scrollToPage(hits[nextIndex].page);
  };

  return (
    <div className="bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-zinc-100 disabled:opacity-40"
            disabled={pageNumber <= 1}
            onClick={() => scrollToPage(pageNumber - 1)}
            type="button"
          >
            Ant.
          </button>
          <label className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm text-zinc-400">
            <input
              className="h-9 w-14 rounded bg-zinc-900 px-2 text-center text-sm text-zinc-100"
              inputMode="numeric"
              min={1}
              max={Math.max(1, pageCount)}
              type="number"
              value={pageNumber}
              onChange={(event) => setPageFromInput(event.target.value)}
            />
            <span>/ {Math.max(1, pageCount)}</span>
          </label>
          <button
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-zinc-100 disabled:opacity-40"
            disabled={pageNumber >= pageCount}
            onClick={() => scrollToPage(pageNumber + 1)}
            type="button"
          >
            Prox.
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded bg-zinc-900 text-zinc-100"
            onClick={() => setSearchOpen((value) => !value)}
            type="button"
            aria-label="Buscar no PDF"
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-3 pb-2">
          <button
            className="grid h-9 place-items-center rounded bg-zinc-900 text-zinc-100 disabled:opacity-40"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((value) => clamp(Number((value - 0.15).toFixed(2)), 0.75, 2.2))}
            type="button"
            aria-label="Diminuir zoom"
          >
            <Minus size={17} />
          </button>
          <button
            className="flex h-9 items-center justify-center gap-2 rounded bg-zinc-900 text-sm font-medium text-zinc-100"
            onClick={() => setZoom(1)}
            type="button"
          >
            <RotateCcw size={15} />
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="grid h-9 place-items-center rounded bg-zinc-900 text-zinc-100 disabled:opacity-40"
            disabled={zoom >= 2.2}
            onClick={() => setZoom((value) => clamp(Number((value + 0.15).toFixed(2)), 0.75, 2.2))}
            type="button"
            aria-label="Aumentar zoom"
          >
            <Plus size={17} />
          </button>
          <button
            className="h-9 rounded bg-zinc-900 text-sm font-medium text-zinc-100"
            onClick={() => setRotation((value) => (value + 90) % 360)}
            type="button"
          >
            Girar
          </button>
        </div>

        {searchOpen && (
          <div className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded bg-zinc-900 px-3 text-sm text-zinc-100"
                placeholder="Buscar no PDF"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runSearch();
                }}
              />
              <button
                className="rounded bg-green-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isSearching}
                onClick={runSearch}
                type="button"
              >
                {isSearching ? "..." : "Ir"}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>{hits.length > 0 ? `${activeHitIndex + 1}/${hits.length} resultado(s)` : "Digite ao menos 2 caracteres"}</span>
              <div className="flex gap-1">
                <button
                  className="grid h-8 w-8 place-items-center rounded bg-zinc-900 text-zinc-200 disabled:opacity-40"
                  disabled={hits.length === 0}
                  onClick={() => goToHit(activeHitIndex - 1)}
                  type="button"
                  aria-label="Resultado anterior"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded bg-zinc-900 text-zinc-200 disabled:opacity-40"
                  disabled={hits.length === 0}
                  onClick={() => goToHit(activeHitIndex + 1)}
                  type="button"
                  aria-label="Proximo resultado"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>
            {hits[activeHitIndex] && (
              <p className="mt-2 rounded bg-zinc-900 p-2 text-xs leading-5 text-zinc-300">
                Pag. {hits[activeHitIndex].page}: {hits[activeHitIndex].excerpt}
              </p>
            )}
          </div>
        )}

        <div className="h-1 bg-zinc-800">
          <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div ref={scrollRef} className="relative h-[calc(100vh-252px)] min-h-[480px] overflow-y-auto bg-zinc-900">
        {isLoading && (
          <div className="absolute inset-x-3 top-3 z-10 rounded bg-zinc-950/90 px-3 py-2 text-center text-sm text-zinc-300">
            Abrindo PDF...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-900 p-6 text-center text-sm leading-6 text-zinc-300">
            {error}
          </div>
        )}
        <div
          className="relative mx-auto w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((item) => (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute left-0 top-0 w-full px-3 py-2"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <PdfPageCanvas
                fitWidth={fitWidth}
                pageNumber={item.index + 1}
                pdf={pdf}
                rotation={rotation}
                zoom={zoom}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PdfPageCanvas({ fitWidth, pageNumber, pdf, rotation, zoom }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageSize, setPageSize] = useState({ width: fitWidth, height: Math.round(fitWidth * 1.42) });
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function renderPage() {
      if (!pdf || !canvasRef.current) return;
      renderTaskRef.current?.cancel?.();
      setIsRendering(true);
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);
        if (disposed) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const fitScale = fitWidth / baseViewport.width;
        const scale = clamp(fitScale * zoom, 0.55, 3);
        const viewport = page.getViewport({ scale, rotation });
        setPageSize({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (!disposed && !(err instanceof Error && err.name === "RenderingCancelledException")) {
          setError(err instanceof Error ? err.message : "Falha ao renderizar pagina");
        }
      } finally {
        if (!disposed) setIsRendering(false);
      }
    }

    renderPage();

    return () => {
      disposed = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [fitWidth, pageNumber, pdf, rotation, zoom]);

  return (
    <div className="mx-auto" style={{ width: pageSize.width }}>
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-zinc-400">
        <span>Pagina {pageNumber}</span>
        {isRendering && <span>Renderizando...</span>}
      </div>
      <div
        className="relative overflow-hidden bg-zinc-100 shadow-lg shadow-black/30"
        style={{ width: pageSize.width, minHeight: pageSize.height }}
      >
        <canvas ref={canvasRef} className="block bg-white" />
        {isRendering && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-100 text-xs text-zinc-500">
            Renderizando...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-100 p-4 text-center text-xs text-zinc-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
