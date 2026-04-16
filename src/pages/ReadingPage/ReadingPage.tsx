import useReadingSession from "./hooks/useReadingSession";
import useViewerLoader from "./hooks/useViewerLoader";
import useEpubViewerLoader from "./hooks/useEpubViewerLoader";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import ReadingSessionTimer from "./components/ReadingSessionTimer";
import PdfViewer from "./components/pdf-reader/Viewer";
import EpubViewer from "./components/epub-reader/Viewer";
import { BookOpenText, FolderOpen, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type FileType = "pdf" | "epub" | null;

interface LibraryDocumentData {
  buffer: ArrayBuffer;
  hash: string;
  fileName: string;
  type: Exclude<FileType, null>;
}

export default function ReadingPage() {
  const location = useLocation();
  const locationFileBuffer = location.state?.fileBuffer as ArrayBuffer | undefined;
  const locationFileHash = location.state?.fileHash as string | undefined;
  const locationFileName = location.state?.fileName as string | undefined;
  const pdf = useViewerLoader();
  const epub = useEpubViewerLoader();
  const session = useReadingSession();
  const [libraryDocumentData, setLibraryDocumentData] =
    useState<LibraryDocumentData | null>(null);
  const [activeSource, setActiveSource] = useState<"library" | "local">("local");
  const [activeType, setActiveType] = useState<FileType>(null);

  useEffect(() => {
    const showDefaultAppToast = () => {
      const isDev = import.meta.env.DEV;
      if (isDev) return;

      const toastId = "default-app-toast";

      toast(
        (t) => (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-300">
              Defina o Lyceum como leitor padrão de PDF e EPUB para abrir arquivos diretamente do explorador.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  window.api.openDefaultAppsSettings();
                  toast.dismiss(t.id);
                }}
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 transition"
              >
                Configurar
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-zinc-400 hover:text-zinc-200 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ),
        {
          id: toastId,
          duration: 15000,
          // icon: "📖",
          style: {
            background: "#27272a",
            color: "#e4e4e7",
            border: "1px solid #3f3f46",
            borderRadius: "4px",
            padding: "12px 16px",
            fontSize: "14px",
          },
        }
      );
    };

    showDefaultAppToast();
  }, []);

  useEffect(() => {
    if (!locationFileBuffer || !locationFileHash) {
      return;
    }

    const extension = locationFileName?.toLowerCase().split(".").pop();
    const type = extension === "epub" ? "epub" : "pdf";

    setLibraryDocumentData({
      buffer: locationFileBuffer,
      hash: locationFileHash,
      fileName: locationFileName || "Livro sem nome",
      type,
    });
    setActiveSource("library");
    setActiveType(type);
  }, [locationFileBuffer, locationFileHash, locationFileName]);

  const activePdfData =
    activeSource === "library" && activeType === "pdf"
      ? libraryDocumentData?.buffer
      : pdf.pdfData;
  const activePdfHash =
    activeSource === "library" && activeType === "pdf"
      ? libraryDocumentData?.hash
      : pdf.fileHash;
  const activePdfName =
    activeSource === "library" && activeType === "pdf"
      ? libraryDocumentData?.fileName
      : pdf.fileName;

  const activeEpubData =
    activeSource === "library" && activeType === "epub"
      ? libraryDocumentData?.buffer
      : epub.epubData;
  const activeEpubHash =
    activeSource === "library" && activeType === "epub"
      ? libraryDocumentData?.hash
      : epub.fileHash;
  const activeEpubName =
    activeSource === "library" && activeType === "epub"
      ? libraryDocumentData?.fileName
      : epub.fileName;

  const handleOpenPdf = async () => {
    await pdf.openFileDialog();
    setActiveSource("local");
    setActiveType("pdf");
  };

  const handleOpenEpub = async () => {
    await epub.openFileDialog();
    setActiveSource("local");
    setActiveType("epub");
  };

  const renderViewer = () => {
    if (activeType === "epub" && activeEpubData && activeEpubHash) {
      return (
        <EpubViewer
          epubData={activeEpubData}
          fileHash={activeEpubHash}
          fileName={activeEpubName}
        />
      );
    }

    if (activeType === "pdf" && activePdfData && activePdfHash) {
      return (
        <PdfViewer
          pdfData={activePdfData}
          fileHash={activePdfHash}
          fileName={activePdfName}
          hasSessionStarted={session.sessionStart}
          hasSessionFinished={session.sessionFinish}
          onReadingInfo={session.handleReadingInfo}
          onTotalBookPages={pdf.handleTotalBookPages}
        />
      );
    }

    return null;
  };

  const hasContent =
    (activeType === "epub" && Boolean(activeEpubData)) ||
    (activeType === "pdf" && Boolean(activePdfData));

  return (
    <>
      {session.showModal && (
        <ReadingSessionCompletedModal
          session={session.session}
          totalBookPages={pdf.totalBookPages}
          onReset={session.handleReset}
          onClose={() => session.setShowModal(false)}
          onSubmit={session.handleSubmit}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="h-screen flex flex-col p-4 space-y-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 pl-6">
                <BookOpenText size={32} className="text-zinc-300" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasContent && (
                <ReadingSessionTimer
                  fileName={activeType === "epub" ? activeEpubName : activePdfName}
                  onSessionStart={session.handleSessionStart}
                  onSessionData={session.handleSessionData}
                  onSessionFinish={session.handleTimerDone}
                  onTimerDone={session.handleTimerDone}
                />
              )}

              <button
                onClick={handleOpenPdf}
                className="flex items-center gap-2 rounded-sm bg-green-600 px-4 py-2 text-lg font-medium text-black transition hover:bg-green-500"
              >
                <FolderOpen size={16} />
                Abrir PDF
              </button>

              <button
                onClick={handleOpenEpub}
                className="flex items-center gap-2 rounded-sm bg-blue-600 px-4 py-2 text-lg font-medium text-black transition hover:bg-blue-500"
              >
                <FolderOpen size={16} />
                Abrir EPUB
              </button>
            </div>
          </header>

          {hasContent ? (
            <section className="flex-1 min-h-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl">
              {renderViewer()}
            </section>
          ) : (
            <section className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl">
              <div className="p-4 text-sm text-zinc-500">
                Abra um PDF ou EPUB para comecar a leitura.
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
