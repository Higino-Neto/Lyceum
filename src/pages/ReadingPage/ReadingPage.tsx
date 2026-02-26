import { useNavigate } from "react-router-dom";
import useReadingSession from "./hooks/useReadingSession";
import useViewerLoader from "./hooks/useViewerLoader";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import ReadingSessionTimer from "./components/ReadingSessionTimer";
import Viewer from "./components/pdf-reader/Viewer";
import { ArrowLeft, FileText } from "lucide-react";

export default function ReadingPage() {
  const navigate = useNavigate();
  const pdf = useViewerLoader();
  const session = useReadingSession();

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
          {/* Header */}
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="cursor-pointer flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Dashboard</span>
              </button>

              <div className="flex gap-2 items-center">
                <FileText className="text-green-500" size={24} />
                <h1 className="text-2xl font-semibold tracking-tight">
                  Leitor de PDF
                </h1>
              </div>

              {pdf.pdfData && (
                <ReadingSessionTimer
                  fileName={pdf.fileName}
                  onSessionStart={session.handleSessionStart}
                  onSessionData={session.handleSessionData}
                  onSessionFinish={session.handleTimerDone}
                  onTimerDone={session.handleTimerDone}
                />
              )}
            </div>

            <button
              onClick={pdf.openFileDialog}
              className="cursor-pointer text-black bg-green-600 hover:bg-green-500 transition px-4 py-1 rounded-lg text-lg font-medium shadow-lg"
            >
              Abrir PDF
            </button>

            <input
              ref={pdf.fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={pdf.handleFileSelect}
              className="hidden"
            />
          </header>

          {/* Área do PDF */}
          {pdf.pdfData ? (
            <section className="bg-zinc-900 flex-1 min-h-0 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
              <Viewer
                pdfData={pdf.pdfData}
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
