import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
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


export default function PdfThumbnails({ pdf, pageCount, currentPage, labels, onPage }: { pdf?: PDFDocumentProxy | null; pageCount: number; currentPage: number; labels: string[] | null; onPage: (page: number) => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const rows = useVirtualizer({ count: Math.ceil(pageCount / 2), getScrollElement: () => scroll.current, estimateSize: () => 230, overscan: 2 });
  useEffect(() => { rows.scrollToIndex(Math.floor((currentPage - 1) / 2), { align: "center" }); }, [currentPage, rows]);
  return <div ref={scroll} className="h-[65dvh] overflow-auto" aria-label="Miniaturas de páginas"><div className="relative w-full" style={{ height: rows.getTotalSize() }}>
    {rows.getVirtualItems().map(row => <div key={row.key} className="absolute left-0 top-0 grid w-full grid-cols-2 gap-3" style={{ height: row.size, transform: `translateY(${row.start}px)` }}>{[row.index * 2 + 1, row.index * 2 + 2].filter(page => page <= pageCount).map(page => <button className={`overflow-hidden rounded-lg border p-2 text-xs ${page === currentPage ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-400"}`} key={page} onClick={() => onPage(page)}><span className="block h-[190px] overflow-hidden"><PdfThumbnail pdf={pdf} pageNumber={page} /></span>{labels?.[page - 1] || page}</button>)}</div>)}
  </div></div>;
}
