import React, { useState, useRef } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PdfReader from "./components/PdfReader";
import ReadingSessionTimer from "./components/ReadingSessionTimer";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import saveReadingEntries from "../../utils/saveReadingEntries";
import { EMPTY_SESSION } from "../../types/ReadingTypes";
import type {
  ReadingSession,
  SessionTimerData,
  SessionPdfData,
} from "../../types/ReadingTypes";

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReadingIframe() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [pdfData, setPdfData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Controle de fase da sessão
  const [sessionStart, setSessionStart] = useState(false);
  const [sessionFinish, setSessionFinish] = useState(false);

  /**
   * `timerDone` indica que o timer terminou e está aguardando os
   * dados do PDF (palavras/páginas). Quando ambos chegarem, o modal abre.
   */
  const [timerDone, setTimerDone] = useState(false);

  // Estado acumulado da sessão
  const [session, setSession] = useState<ReadingSession>(EMPTY_SESSION);

  // ── Seleção de arquivo ──────────────────────────────────────────────────
  const openFileDialog = () => fileInputRef.current?.click();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPdfData(url);
  };

  console.log(session);

  // ── Callbacks do timer ──────────────────────────────────────────────────

  /** Timer iniciou: registra a página atual no PdfReader */
  const handleSessionStart = () => setSessionStart(true);

  /**
   * Timer recebeu dados (nome, categoria, tempo).
   * Acumula no estado da sessão.
   */
  const handleSessionData = (data: SessionTimerData) => {
    setSession((prev) => ({
      ...prev,
      id: data.id,
      sourceName: data.sourceName,
      date: data.date,
      category: data.category,
      spentTimeMinutes: prev.spentTimeMinutes + data.spentTimeMinutes,
    }));
  };

  /**
   * Timer terminou: pede ao PdfReader para calcular palavras/páginas.
   * Não abre o modal ainda — aguarda `onPdfInfo`.
   */
  const handleTimerDone = () => {
    setSessionStart(false);
    setSessionFinish(true); // dispara extração no PdfReader
    setTimerDone(true); // marca que estamos esperando o PDF
  };

  // ── Callback do PdfReader ───────────────────────────────────────────────

  /**
   * PdfReader concluiu a extração. Acumula os dados de páginas/palavras
   * e, se o timer já terminou, abre o modal.
   */
  const handlePdfInfo = (data: SessionPdfData) => {
    setSession((prev) => ({
      ...prev,
      totalWords: prev.totalWords + data.totalWords,
      initialPage: prev.initialPage === 0 ? data.initialPage : prev.initialPage,
      finalPage: data.finalPage,
    }));

    if (timerDone) {
      setTimerDone(false);
      setShowModal(true);
    }
  };

  const handleFinalizeHandled = () => setSessionFinish(false);

  // ── Salvar sessão no banco ──────────────────────────────────────────────
  const handleSubmit = async () => {
    await saveReadingEntries([
      {
        id: crypto.randomUUID(),
        bookTitle: session.sourceName,
        numPages: String(session.finalPage - session.initialPage + 1),
        category: session.category,
        readingTime: String(session.spentTimeMinutes),
        date: new Date().toISOString().split("T")[0],
      },
    ]);

    setSession(EMPTY_SESSION);
  };

  const handleReset = () => setSession(EMPTY_SESSION);
  const handleCloseModal = () => setShowModal(false);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showModal && (
        <ReadingSessionCompletedModal
          session={{
            id: session.id,
            sourceName: session.sourceName,
            date: session.date,
            category: session.category,
            spentTimeMinutes: session.spentTimeMinutes,
            totalWords: String(session.totalWords),
            initialPage: String(session.initialPage),
            finalPage: String(session.finalPage),
            totalBookPages: 455, // TODO: buscar do DB quando livros forem implementados
          }}
          onReset={handleReset}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
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

              {pdfData && (
                <ReadingSessionTimer
                  fileName={fileName}
                  onSessionStart={handleSessionStart}
                  onSessionData={handleSessionData}
                  onSessionFinish={handleTimerDone}
                  onTimerDone={handleTimerDone}
                />
              )}
            </div>

            <button
              onClick={openFileDialog}
              className="cursor-pointer text-black bg-green-600 hover:bg-green-500 transition px-4 py-1 rounded-lg text-lg font-medium shadow-lg"
            >
              Abrir PDF
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </header>

          {/* Área do PDF */}
          {pdfData ? (
            <section className="bg-zinc-900 flex-1 min-h-0 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
              <PdfReader
                pdfData={pdfData}
                sessionStart={sessionStart}
                sessionFinish={sessionFinish}
                onPdfInfo={handlePdfInfo}
                onFinalizeHandled={handleFinalizeHandled}
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
