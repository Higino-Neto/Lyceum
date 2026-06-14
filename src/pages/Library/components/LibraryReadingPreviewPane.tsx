import type { PointerEvent as ReactPointerEvent } from "react";
import { BookOpen, X } from "lucide-react";
import { TabProvider } from "../../../contexts/TabContext";
import {
  ReadingWorkspace,
  type ReadingLaunchState,
} from "../../ReadingPage/ReadingPage";

interface LibraryReadingPreviewPaneProps {
  width: number;
  incomingTab: ReadingLaunchState | null;
  onIncomingTabConsumed: () => void;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent) => void;
  drawer?: boolean;
}

export default function LibraryReadingPreviewPane({
  width,
  incomingTab,
  onIncomingTabConsumed,
  onClose,
  onResizeStart,
  drawer = false,
}: LibraryReadingPreviewPaneProps) {
  return (
    <aside
      data-library-preview
      className={`lyceum-library-reading-preview h-full overflow-hidden border-l border-zinc-800 bg-zinc-950 ${
        drawer ? "fixed bottom-0 right-0 top-0 z-50 shadow-2xl" : "relative flex-shrink-0"
      }`}
      style={{
        flexBasis: drawer ? undefined : width,
        width: drawer ? "min(94vw, 640px)" : width,
        minWidth: drawer ? 0 : 380,
        maxWidth: drawer ? undefined : 900,
      }}
    >
      <button
        type="button"
        onPointerDown={onResizeStart}
        className={`absolute -left-1 top-0 z-20 h-full w-3 cursor-col-resize bg-transparent hover:bg-green-500/70 ${
          drawer ? "hidden" : ""
        }`}
        title="Redimensionar previa de leitura"
      />

      <div className="flex h-full min-w-0 flex-col">
        <header className="flex h-11 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen size={16} className="flex-shrink-0 text-green-400" />
            <span className="truncate text-sm font-medium text-zinc-200">
              Previa de leitura
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            title="Fechar previa"
            aria-label="Fechar previa"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1">
          <TabProvider scope="preview">
            <ReadingWorkspace
              incomingTab={incomingTab}
              onIncomingTabConsumed={onIncomingTabConsumed}
              enableShortcuts={false}
            />
          </TabProvider>
        </div>
      </div>
    </aside>
  );
}
