import { PluginRegistry } from "@embedpdf/react-pdf-viewer";
import { useCallback, useEffect, useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import PdfViewerCore from "./ViewerCore";
import PdfJsViewer from "./PdfJsViewer";
import useSessionTracker from "../../hooks/useSessionTracker";
import useScroll from "../../hooks/useScroll";
import getWordCount from "../../../../utils/getWordCount";
import useReadingPersistence from "../../hooks/useReadingPersistence";
import {
  DEFAULT_PDF_RENDERER,
  PDF_RENDERER_OPTIONS,
  type PdfRenderer,
} from "./pdfRenderer";

interface ViewerProps {
  pdfData: ArrayBuffer;
  fileHash: string;
  fileName?: string;
  hasSessionStarted: boolean;
  hasSessionFinished: boolean;
  onTotalBookPages: (totalBookPages: number) => void;
  onReadingInfo: (data: SessionPdfData) => void;
  renderer?: PdfRenderer;
  onRendererChange?: (renderer: PdfRenderer) => void;
}

function EmbedPdfViewer({
  pdfData,
  fileHash,
  fileName,
  hasSessionStarted,
  hasSessionFinished,
  onTotalBookPages,
  onReadingInfo,
}: ViewerProps) {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  useReadingPersistence(registry, fileHash)
  const { currentPage, totalPages } = useScroll(registry);

  const handleSessionFinished = async (info: {
    initialPage: number;
    finalPage: number;
  }) => {
    const totalWords = await getWordCount(
      registry,
      info.initialPage,
      info.finalPage,
    );

    onReadingInfo({
      totalWords: totalWords ?? 0,
      initialPage: info.initialPage,
      finalPage: info.finalPage,
    });
  };

  useSessionTracker(
    hasSessionStarted,
    hasSessionFinished,
    currentPage,
    handleSessionFinished,
  );

  useEffect(() => {
    if (!totalPages) return;
    onTotalBookPages(totalPages);
  }, [totalPages]);

  return (
    <div className="relative h-full w-full">
      <PdfViewerCore
        pdfData={pdfData}
        documentId={fileHash}
        fileName={fileName}
        onReady={(registry) => {
          setRegistry(registry);
        }}
      />
    </div>
  );
}

export default function Viewer({
  renderer = DEFAULT_PDF_RENDERER,
  onRendererChange,
  ...props
}: ViewerProps) {
  const activeRenderer = renderer === "pdfjs" ? "pdfjs" : DEFAULT_PDF_RENDERER;

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-2">
        <div className="flex min-w-0 items-center gap-1">
          {PDF_RENDERER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRendererChange?.(option.value)}
              className={`h-7 rounded-sm border px-2 text-xs font-medium transition-colors ${
                activeRenderer === option.value
                  ? "border-green-500/70 bg-green-500/15 text-green-100"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="truncate text-[11px] text-zinc-500">
          {activeRenderer === "pdfjs" ? "Mozilla PDF.js Viewer" : "EmbedPDF"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {activeRenderer === "pdfjs" ? (
          <PdfJsViewer {...props} />
        ) : (
          <EmbedPdfViewer {...props} renderer={activeRenderer} onRendererChange={onRendererChange} />
        )}
      </div>
    </div>
  );
}
