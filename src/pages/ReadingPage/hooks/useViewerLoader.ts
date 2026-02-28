import { useEffect, useRef, useState } from "react";

export default function useViewerLoader() {
  const [fileName, setFileName] = useState("");
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [totalBookPages, setTotalBookPages] = useState<number | null>(null);

  const handleTotalBookPages = (pages: number) => setTotalBookPages(pages);

  // Reabre o último PDF automaticamente
  useEffect(() => {
    const reopenLast = async () => {
      const last = await window.api.getLastDocument();
      if (!last) return;

      const result = await window.api.reopenPdf(last.filePath);
      if (!result) return; // arquivo foi deletado/movido

      const blob = new Blob([result.fileBuffer], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      setPdfPath(blobUrl);
      setFileName(last.title);
      setFileHash(last.fileHash);
    };
    reopenLast();
  }, []);

  const openFileDialog = async () => {
    const document = await window.api.openPdf();
    if (!document) return;
    const blob = new Blob([document.fileBuffer], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    setPdfPath(blobUrl);
    setFileName(document.title);
    setFileHash(document.fileHash);
  };

  return {
    pdfData: pdfPath,
    fileName,
    fileHash,
    totalBookPages,
    handleTotalBookPages,
    openFileDialog,
  };
}
