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
    <PdfJsViewer
      {...props}
      showChapters={showChapters}
      onToggleChapters={() => setShowChapters((value) => !value)}
      onCloseChapters={() => setShowChapters(false)}
    />
  );
}
