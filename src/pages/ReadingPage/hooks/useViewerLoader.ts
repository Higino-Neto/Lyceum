import { useRef, useState } from "react";

export default function useViewerLoader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [totalBookPages, setTotalBookPages] = useState<number | null>(null);

  const openFileDialog = () => fileInputRef.current?.click();

  const handleTotalBookPages = (pages: number) => {
    setTotalBookPages(pages);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPdfData(url);
  };

  return {
    pdfData,
    fileName,
    fileInputRef,
    totalBookPages,
    openFileDialog,
    handleTotalBookPages,
    handleFileSelect,
  };
}
