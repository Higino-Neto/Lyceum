import { useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import PdfJsViewer from "./PdfJsViewer";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";

interface ViewerProps {
  pdfData: ArrayBuffer;
  fileHash: string;
  fileName?: string;
  hasSessionStarted: boolean;
  hasSessionFinished: boolean;
  onTotalBookPages: (totalBookPages: number) => void;
  onReadingInfo: (data: SessionPdfData) => void;
}

export default function Viewer({
  ...props
}: ViewerProps) {
  const [showChapters, setShowChapters] = useLocalStorage<boolean>(
    "pdf-chapters-open",
    false,
  );

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowChapters((value) => !value)}
            aria-pressed={showChapters}
            title="Mostrar/ocultar painel de capítulos"
            className={`h-7 rounded-sm border px-2 text-xs font-medium transition-colors ${
              showChapters
                ? "border-green-500/70 bg-green-500/15 text-green-100"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            Capítulos
          </button>
        </div>
        <span className="truncate text-[11px] text-zinc-500">
          Mozilla PDF.js Viewer
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <PdfJsViewer
          {...props}
          showChapters={showChapters}
          onCloseChapters={() => setShowChapters(false)}
        />
      </div>
    </div>
  );
}
