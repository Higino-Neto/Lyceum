import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function useViewerLoader() {
  const [fileName, setFileName] = useState("");
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [totalBookPages, setTotalBookPages] = useState<number | null>(null);

  const handleTotalBookPages = (pages: number) => setTotalBookPages(pages);

  // Reabre o último PDF automaticamente
  useEffect(() => {
    const reopenLast = async () => {
      const last = await window.api.getLastDocument();
      if (!last) return;

      const result = await window.api.reopenPdf(last.filePath, last.fileHash);
      if (!result || "error" in result) return;

      setPdfData(result.fileBuffer);
      setFileName(last.title);
      setFileHash(result.fileHash);
    };
    reopenLast();
  }, []);

  const openFileDialog = async () => {
    try {
      const document = await window.api.openPdf();
      if (!document) {
        toast.error("Falha ao abrir arquivo");
        return;
      }
      setPdfData(document.fileBuffer);
      setFileName(document.title);
      setFileHash(document.fileHash);
    } catch (error) {
      toast.error("Erro ao carregar o arquivo");
    }
  };

  return {
    pdfData,
    fileName,
    fileHash,
    totalBookPages,
    handleTotalBookPages,
    openFileDialog,
  };
}
