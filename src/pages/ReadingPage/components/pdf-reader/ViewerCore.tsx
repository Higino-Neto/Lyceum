import PDFViewer, {
  DocumentManagerPlugin,
  PDFViewerRef,
  PluginRegistry,
  ScrollStrategy,
} from "@embedpdf/react-pdf-viewer";
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { DARK_THEME } from "./theme";
import { useRef } from "react";
import toast from "react-hot-toast";

interface ViewerCoreProps {
  pdfData: ArrayBuffer;
  documentId: string;
  fileName?: string;
  onReady: (registry: PluginRegistry) => void;
}

export default function ViewerCore({
  pdfData,
  documentId,
  fileName,
  onReady,
}: ViewerCoreProps) {
  const viewerRef = useRef<PDFViewerRef>(null);

  const handleReady = async () => {
    const registry = await viewerRef.current?.registry;
    if (!registry) return;

    const documentManager = registry
      .getPlugin<DocumentManagerPlugin>("document-manager")
      ?.provides();

    if (documentManager) {
      documentManager.onDocumentError((event) => {
        toast.error(event.message || "Erro ao carregar PDF");
      });

      await documentManager.closeAllDocuments().toPromise();
      documentManager.openDocumentBuffer({
        buffer: pdfData,
        documentId,
        name: fileName || `${documentId}.pdf`,
        autoActivate: true,
      });
    }

    onReady(registry);
  };

  return (
    <>
      <PDFViewer
        key={documentId}
        ref={viewerRef}
        onReady={handleReady}
        config={{
          wasmUrl: pdfiumWasmUrl,
          worker: false,
          scroll: {
            defaultStrategy: ScrollStrategy.Vertical,
            defaultPageGap: 20,
          },
          theme: {
            preference: "dark",
            // ...DARK_THEME,
            dark: DARK_THEME,
          },
        }}
        className={`h-[calc(100vh-80px)]`}
      />
    </>
  );
}
