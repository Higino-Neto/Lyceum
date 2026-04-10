import {
  DocumentManagerPlugin,
  PluginRegistry,
} from "@embedpdf/react-pdf-viewer";
import { useCallback, useEffect, useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import PdfViewerCore from "./ViewerCore";
import useSessionTracker from "../../hooks/useSessionTracker";
import useScroll from "../../hooks/useScroll";
import getWordCount from "../../../../utils/getWordCount";
import useReadingPersistence from "../../hooks/useReadingPersistence";

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
    <div className="w-full relative">
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
