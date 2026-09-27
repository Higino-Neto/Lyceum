import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { translate } from "../../../i18n";

export default function useEpubViewerLoader() {
  const [fileName, setFileName] = useState("");
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);

  const openFileDialog = async () => {
    try {
      const document = await window.api.openEpub();
      if (!document) {
        toast.error(translate("reading:viewer.epub.openFailed"));
        return;
      }
      setEpubData(document.fileBuffer);
      setFileName(document.title);
      setFileHash(document.fileHash);
    } catch (error) {
      toast.error(translate("reading:viewer.epub.loadFailed"));
    }
  };

  return {
    epubData,
    fileName,
    fileHash,
    openFileDialog,
  };
}
