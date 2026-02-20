import PDFViewer, {
  DocumentManagerPlugin,
  EmbedPdfContainer,
  PluginRegistry,
} from "@embedpdf/react-pdf-viewer";
import { useEffect, useRef, useState } from "react";
import Recents from "./Recents";

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

// export default function PdfReader({ pdfData }: PdfReaderProps) {
//   return (
//     <>
//       <iframe src={pdfData} className="w-full h-full" />
//     </>
//   );
// }

export default function PdfReader({ pdfData }: PdfReaderProps) {
  const containerRef = useRef<EmbedPdfContainer | null>(null);
  const registryRef = useRef<PluginRegistry | null>(null);
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // console.log(annotations);

  const handleReady = (registry: PluginRegistry) => {
    registryRef.current = registry;
    setRegistry(registry);
  };

  //   useEffect(() => {
  //     if (!registryRef.current) return;

  //     const annotationPlugin = registryRef.current
  //       .getPlugin("annotation")
  //       ?.provides();

  //     if (!annotationPlugin) return;

  //     const unsubscribe = annotationPlugin.onAnnotationCreated(
  //       (annotation: any) => {
  //         console.log("Nova anotação:", annotation);
  //       },
  //     );

  //     return () => {
  //       unsubscribe?.();
  //     };
  //   }, [registryRef.current]);

  // useEffect(() => {
  //   if (!registry) return;

  //   const annotationPlugin = registry
  //     .getPlugin("annotation")
  //     ?.provides();

  //   if (!annotationPlugin) return;

  //   const unsubscribe = annotationPlugin.onAnnotationEvent((event) => {
  //     const { type, annotation, pageIndex, committed } = event;
  //     console.log("Evento:", type, { annotation, pageIndex, committed });
  //   });

  //   return () => unsubscribe?.();
  // }, [registry]);

  const handleInit = (container: EmbedPdfContainer) => {
    containerRef.current = container;
  };

  //   const handleReady = (registry: PluginRegistry) => {
  //     registryRef.current = registry;
  //   };

  //   const getDocumentMetadata = async () => {
  //     if (!registryRef.current) return;

  //     const engine = registryRef.current.getEngine();

  //     const documentManager = registryRef.current
  //       .getPlugin<DocumentManagerPlugin>("document-manager")
  //       ?.provides();

  //     const document = documentManager?.getActiveDocument();

  //     if (engine && document) {
  //       const allAnnotationsTask = engine.getAllAnnotations(document);

  //       console.log(allAnnotationsTask);
  //     }
  //   };

  useEffect(() => {
    const registry = registryRef.current;
    if (!registry) return;

    const annotationPlugin = registry.getPlugin("annotation")?.provides();

    if (!annotationPlugin) return;

    const unsubscribe = annotationPlugin.onAnnotationEvent((event) => {
      const { type, annotation, pageIndex, committed } = event;
      // console.log("Annotation event:", {
      //   type,
      //   annotation,
      //   pageIndex,
      //   committed,
      // });

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

  //   const saveAnnotations = async () => {
  //     if (!registry) return;

  //     const documentManager = registry
  //       .getPlugin<DocumentManagerPlugin>("document-manager")
  //       ?.provides();
  //     if (!documentManager) return;

  //     const engine = registry.getEngine();

  //     const document = documentManager?.getActiveDocument();
  //     if (!document) return;

  //     const annotations = await engine.getAllAnnotations(document).toPromise();
  //     console.log(annotations);
  //   };

  return (
    <div className="w-full h-screen">
      <PDFViewer
        onInit={handleInit}
        onReady={handleReady}
        config={{
          src: pdfData,
          //   theme: { preference: "dark" },
          theme: {
            preference: "dark",
            dark: {
              accent: {
                primary: "#22c55e", // green-500
                primaryHover: "#16a34a", // green-600
                primaryActive: "#15803d", // green-700
                primaryLight: "#14532d", // green-900
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
                app: "#18181b", // zinc-950
                surface: "#18181b", // zinc-900
                surfaceAlt: "#1f1f23", // leve variação
                elevated: "#27272a", // zinc-800
                overlay: "rgba(0,0,0,0.7)",
                input: "#18181b",
              },

              foreground: {
                primary: "#f4f4f5", // zinc-100
                secondary: "#d4d4d8", // zinc-300
                muted: "#a1a1aa", // zinc-400
                disabled: "#71717a", // zinc-500
                onAccent: "#ffffff",
              },

              interactive: {
                hover: "#27272a", // zinc-800
                active: "#3f3f46", // zinc-700
                selected: "#14532d", // green-900
                focus: "#22c55e", // green-500
              },

              border: {
                default: "#27272a", // zinc-800
                subtle: "#1f1f23",
                strong: "#22c55e",
              },

              state: {
                error: "#ef4444", // red-500
                errorLight: "#7f1d1d",
                warning: "#f59e0b", // amber-500
                warningLight: "#78350f",
                success: "#22c55e", // green-500
                successLight: "#14532d",
                info: "#3b82f6", // blue-500
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
