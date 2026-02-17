import React, { useState, useRef } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ReadingIframe: React.FC = () => {
  const navigate = useNavigate()
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [, setFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    // Limpar URL anterior
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    // Criar URL temporária (mais eficiente que data URL)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPdfData(url)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  // const handlePrint = () => {
  //   if (pdfData) {
  //     const printWindow = window.open(pdfData)
  //     printWindow?.print()
  //   }
  // }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-8 overflow-auto ">
        <div className="max-w-7xl mx-auto space-y-8 ">
          {/* Header */}
          <header className="flex justify-between items-center ">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
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

          {/* Barra de informações do arquivo (só aparece quando tem PDF) */}
          {/* {pdfData && fileName && (
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-green-500">📄</span>
                  <span className="text-zinc-300 font-medium">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                    title="Imprimir"
                  >
                    <Printer size={18} />
                  </button>
                  <a
                    href={pdfData}
                    download={fileName}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download size={18} />
                  </a>
                </div>
              </div>
            </div>
          )} */}

          {/* Área do PDF */}
          <section className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl overflow-hidden">
            <div className="h-[calc(100vh)]">
              {pdfData ? (
                <iframe
                  src={pdfData}
                  className="w-full h-full"
                  title="PDF Viewer"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                  <div className="text-8xl mb-4">📚</div>
                  <h2 className="text-2xl font-bold text-zinc-300 mb-2">Nenhum PDF aberto</h2>
                  <p className="mb-6 text-zinc-500">Clique em "Abrir PDF" para começar</p>
                  <button
                    onClick={openFileDialog}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-black rounded-lg font-medium transition-colors shadow-lg"
                  >
                    Selecionar arquivo
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Dica (opcional) */}
          {!pdfData && (
            <div className="text-center text-zinc-600 text-sm">
              <p>Formatos suportados: PDF • Visualização nativa do Electron</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ReadingIframe