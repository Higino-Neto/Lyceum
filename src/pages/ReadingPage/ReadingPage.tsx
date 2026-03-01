import useReadingSession from "./hooks/useReadingSession";
import useViewerLoader from "./hooks/useViewerLoader";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import ReadingSessionTimer from "./components/ReadingSessionTimer";
import Viewer from "./components/pdf-reader/Viewer";
import { BookOpenText } from "lucide-react";
import useGetBookData from "./hooks/useGetBookData";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ReadingPage() {
  const location = useLocation();
  const locationFileBuffer = location.state?.fileBuffer as ArrayBuffer | undefined;
  const locationFileHash = location.state?.fileHash as string | undefined;
  console.log(locationFileBuffer, locationFileHash);
  const pdf = useViewerLoader();
  const session = useReadingSession();
  const [libraryPdfData, setLibraryPdfData] = useState<{
    url: string;
    hash: string;
  } | null>(null);
  const [activeSource, setActiveSource] = useState<"library" | "local">(
    "local",
  );

  useEffect(() => {
    if (locationFileBuffer && locationFileHash) {
      const blob = new Blob([locationFileBuffer], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      setLibraryPdfData({ url: blobUrl, hash: locationFileHash });
      setActiveSource("library");
    }
  }, [locationFileBuffer, locationFileHash]);

  const activePdfData =
    activeSource === "library" ? libraryPdfData?.url : pdf.pdfData;

  const activeFileHash =
    activeSource === "library" ? libraryPdfData?.hash : pdf.fileHash;
  // const bookData = useGetBookData();

  // console.log(bookData)

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

      <div className="min-h-screen bg-zinc-950 text-zinc-100 ">
        <div className=" h-screen  flex flex-col p-4 space-y-4">
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex gap-2 items-center pl-6">
                <BookOpenText size={32} className="text-zinc-300" />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {activePdfData && (
                <ReadingSessionTimer
                  fileName={pdf.fileName}
                  onSessionStart={session.handleSessionStart}
                  onSessionData={session.handleSessionData}
                  onSessionFinish={session.handleTimerDone}
                  onTimerDone={session.handleTimerDone}
                />
              )}

              <button
                onClick={async () => {
                  await pdf.openFileDialog();
                  setActiveSource("local");
                }}
                className="cursor-pointer text-black bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-sm text-lg font-medium"
              >
                Abrir PDF
              </button>
            </div>
          </header>

          {activePdfData && activeFileHash ? (
            <section className="bg-zinc-900 flex-1 min-h-0 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
              <Viewer
                pdfData={activePdfData}
                fileHash={activeFileHash}
                hasSessionStarted={session.sessionStart}
                hasSessionFinished={session.sessionFinish}
                onReadingInfo={session.handleReadingInfo}
                onTotalBookPages={pdf.handleTotalBookPages}
              />
            </section>
          ) : (
            <section className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
              <div className="p-4 text-zinc-500 text-sm">
                {/* TODO: Card list dos livros recentes (localStorage ou Supabase) */}
                Abra um PDF para começar a leitura.
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
