import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PdfReader from "../components/PdfReader";

const ReadingIframe: React.FC = () => {
  const navigate = useNavigate();
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Limpar URL anterior
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    // Criar URL temporária (mais eficiente que data URL)
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPdfData(url);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // useEffect(() => {
  //   const handleWheel = (e: WheelEvent) => {
  //     e.preventDefault();
  //     const smoothy = 0.001;
  //     const delta = -e.deltaY * smoothy;
  //     window.electronAPI.zoom(delta);
  //   }

  //   window.addEventListener("wheel", handleWheel, { passive: false })

  //   return () => {
  //     window.removeEventListener("wheel", handleWheel)
  //   }
  // }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-8 overflow-auto ">
        <div className="max-w-7xl mx-auto space-y-8 ">
          {/* Header */}
          <header className="flex justify-between items-center ">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Voltar</span>
              </button>
              <div>
                <div className="flex gap-2 items-center">
                  <FileText className="text-green-500" size={24} />
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Leitor de PDF
                  </h1>
                </div>
              </div>
            </div>

            <button
              onClick={openFileDialog}
              className="cursor-pointer text-black bg-green-600 hover:bg-green-500 transition px-5 py-2.5 rounded-lg text-lg font-medium shadow-lg"
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
          <section className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
            <div className="w-full h-screen">
              <PdfReader pdfData={pdfData} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ReadingIframe;
