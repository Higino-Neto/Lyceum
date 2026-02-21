import PDFViewer, {
  EmbedPdfContainer,
  PluginRegistry,
} from "@embedpdf/react-pdf-viewer";
import { useEffect, useRef, useState } from "react";

interface PdfReaderProps {
  pdfData: string;
}

interface Annotation {
  type: string;
  annotation: {
    id: string;
    custom: {
      text: string;
    };
  };
  pageIndex: string;
  committed: string;
}

export default function PdfReader({ pdfData }: PdfReaderProps) {
  const containerRef = useRef<EmbedPdfContainer | null>(null);
  const registryRef = useRef<PluginRegistry | null>(null);
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const handleReady = (registry: PluginRegistry) => {
    registryRef.current = registry;
    setRegistry(registry);
  };

  const handleInit = (container: EmbedPdfContainer) => {
    containerRef.current = container;
  };


  useEffect(() => {
    const registry = registryRef.current;
    if (!registry) return;

    const annotationPlugin = registry.getPlugin("annotation")?.provides();

    if (!annotationPlugin) return;

    const unsubscribe = annotationPlugin.onAnnotationEvent((event) => {
      const { type, annotation, pageIndex, committed } = event;

      setAnnotations((prev) => [
        ...prev,
        {
          type,
          annotation,
          pageIndex,
          committed,
        },
      ]);
    });

    return () => unsubscribe?.();
  }, [registryRef.current]);

  return (
    <div className="w-full h-screen">
      <PDFViewer
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
                annotationAuthor: "John Doe",
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
        className="h-screen"
      />
    </div>
  );
}
