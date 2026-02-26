import PDFViewer, { PluginRegistry } from "@embedpdf/react-pdf-viewer";
import { DARK_THEME } from "./theme";

interface ViewerCoreProps {
  pdfData: string;
  onReady: (registry: PluginRegistry) => void;
}

export default function ViewerCore({ pdfData, onReady }: ViewerCoreProps) {
  const handleReady = (registry: PluginRegistry) => {
    onReady(registry);
  };

  return (
    <>
      <PDFViewer
        key={pdfData}
        onReady={handleReady}
        config={{
          src: pdfData,
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
