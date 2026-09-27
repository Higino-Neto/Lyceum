import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { translate } from "../../../i18n";

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

      setPdfData(result.fileBuffer ?? null);
      setFileName(last.title);
      setFileHash(result.fileHash);
    };
    reopenLast();
  }, []);

  const openFileDialog = async () => {
    try {
      const document = await window.api.openPdf();
      if (!document) {
        toast.error(translate("reading:viewer.openFailed"));
        return;
      }
      setPdfData(document.fileBuffer ?? null);
      setFileName(document.title);
      setFileHash(document.fileHash);
    } catch (error) {
      toast.error(translate("reading:viewer.loadFailed"));
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
