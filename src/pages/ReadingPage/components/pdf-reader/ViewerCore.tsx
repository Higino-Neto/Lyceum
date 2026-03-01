import PDFViewer, {
  DocumentManagerPlugin,
  PDFViewerRef,
  PluginRegistry,
  ScrollPlugin,
  ScrollStrategy,
} from "@embedpdf/react-pdf-viewer";
import { DARK_THEME } from "./theme";
import { useRef } from "react";

interface ViewerCoreProps {
  pdfData: string;
  onReady: (registry: PluginRegistry) => void;
}

export default function ViewerCore({ pdfData, onReady }: ViewerCoreProps) {
  const viewerRef = useRef<PDFViewerRef>(null);

  const handleReady = async () => {
    const registry = await viewerRef.current?.registry;
    if (!registry) return;

    const docManager = registry.getPlugin<DocumentManagerPlugin>("document-manager")?.provides();
    const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
    const zoom = registry.getPlugin("zoom")?.provides();
    const annotation = registry.getPlugin("annotation")?.provides();

    onReady(registry);
  };

  return (
    <>
      <PDFViewer
        key={pdfData}
        ref={viewerRef}
        onReady={handleReady}
        config={{
          src: pdfData,
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
