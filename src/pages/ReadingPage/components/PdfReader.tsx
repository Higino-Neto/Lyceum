import PDFViewer, {
  EmbedPdfContainer,
  PluginRegistry,
} from "@embedpdf/react-pdf-viewer";
import { useEffect, useRef, useState } from "react";
import type { SessionPdfData } from "../../../types/ReadingTypes";

interface PdfReaderProps {
  pdfData: string;
  sessionStart: boolean;
  sessionFinish: boolean;
  onPdfInfo: (data: SessionPdfData) => void;
  onFinalizeHandled: () => void;
}

export default function PdfReader({
  pdfData,
  sessionStart,
  sessionFinish,
  onPdfInfo,
  onFinalizeHandled,
}: PdfReaderProps) {
  const containerRef = useRef<EmbedPdfContainer | null>(null);
  const registryRef = useRef<PluginRegistry | null>(null);
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  const [currentPage, setCurrentPage] = useState(0); // 0-based internamente
  const initialPageRef = useRef(0);

  // ── Handlers de inicialização do viewer ────────────────────────────────────
  const handleReady = (reg: PluginRegistry) => {
    registryRef.current = reg;
    setRegistry(reg);
  };

  const handleInit = (container: EmbedPdfContainer) => {
    containerRef.current = container;
  };

  // ── Captura a página inicial quando a sessão começa ────────────────────────
  useEffect(() => {
    if (sessionStart) {
      initialPageRef.current = currentPage;
    }
  }, [sessionStart]);

  // ── Finaliza a sessão: extrai contagem de palavras e notifica o pai ────────
  useEffect(() => {
    if (!sessionFinish) return;

    const finalize = async () => {
      const finalPage = currentPage;
      const totalWords = await extractWordCount(
        initialPageRef.current,
        finalPage,
      );

      onPdfInfo({
        totalWords: totalWords ?? 0,
        initialPage: initialPageRef.current + 1, // Exibição 1-based
        finalPage: finalPage + 1,
      });

      onFinalizeHandled();
    };

    finalize();
  }, [sessionFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escuta mudanças de página do scroll plugin ─────────────────────────────
  useEffect(() => {
    if (!registry) return;

    const scrollPlugin = registry.getPlugin("scroll")?.provides();
    if (!scrollPlugin) return;

    const unsubscribe = scrollPlugin.onPageChange(({ pageNumber }) => {
      setCurrentPage(pageNumber - 1); // Converte para 0-based
    });

    return () => unsubscribe?.();
  }, [registry]);

  // ── Extração de texto por intervalo de páginas ─────────────────────────────
  const extractWordCount = async (
    from: number,
    to: number,
  ): Promise<number> => {
    const engine = registryRef.current?.getEngine();
    if (!engine) return 0;

    const documentManager = registryRef.current
      ?.getPlugin("document-manager")
      ?.provides();
    const doc = documentManager?.getActiveDocument();
    if (!doc) return 0;

    const pageRange = Array.from({ length: to - from + 1 }, (_, i) => from + i);

    const text = await engine.extractText(doc, pageRange).toPromise();

    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  return (
    <div className="w-full relative">
      <PDFViewer
        key={pdfData}
        onInit={handleInit}
        onReady={handleReady}
        config={{
          src: pdfData,
          theme: {
            preference: "dark",
            dark: {
              accent: {
                primary: "#22c55e",
                primaryHover: "#16a34a",
                primaryActive: "#15803d",
                primaryLight: "#14532d",
                primaryForeground: "#ffffff",
              },
              annotation: {
                highlightColor: "rgba(34, 197, 94, 0.35)",
                highlightActiveColor: "rgba(34, 197, 94, 0.5)",
                annotationAuthor: "Usuário",
                autoCommit: true,
                selectAfterCreate: true,
              },
              background: {
                app: "#18181b",
                surface: "#18181b",
                surfaceAlt: "#1f1f23",
                elevated: "#27272a",
                overlay: "rgba(0,0,0,0.7)",
                input: "#18181b",
              },
              foreground: {
                primary: "#f4f4f5",
                secondary: "#d4d4d8",
                muted: "#a1a1aa",
                disabled: "#71717a",
                onAccent: "#ffffff",
              },
              interactive: {
                hover: "#27272a",
                active: "#3f3f46",
                selected: "#14532d",
                focus: "#22c55e",
              },
              border: {
                default: "#27272a",
                subtle: "#1f1f23",
                strong: "#22c55e",
              },
              state: {
                error: "#ef4444",
                errorLight: "#7f1d1d",
                warning: "#f59e0b",
                warningLight: "#78350f",
                success: "#22c55e",
                successLight: "#14532d",
                info: "#3b82f6",
                infoLight: "#1e3a8a",
              },
            },
          },
        }}
        className="h-[calc(100vh-80px)]"
      />
    </div>
  );
}