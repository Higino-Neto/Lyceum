import {
  PluginRegistry,
  ScrollPlugin,
  ZoomPlugin,
} from "@embedpdf/react-pdf-viewer";
import { useEffect, useRef } from "react";
import useReadingStatePersistence from "./useReadingStatePersistence";

export default function useReadingPersistence(
  registry: PluginRegistry | null,
  fileHash: string,
) {
  const registryRef = useRef(registry);
  const fileHashRef = useRef(fileHash);
  const currentPageRef = useRef(1);
  const currentZoomRef = useRef(1);
  const currentScrollRef = useRef(0);
  const restoredRef = useRef(false);
  const engineRef = useRef<any>(null);

  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

  useEffect(() => {
    registryRef.current = registry;
    if (registry) {
      engineRef.current = registry.getEngine();
    }
  }, [registry]);

  useEffect(() => {
    fileHashRef.current = fileHash;
  }, [fileHash]);

  useEffect(() => {
    restoredRef.current = false;
  }, [fileHash]);

  useEffect(() => {
    if (!registry || !fileHash) return;

    let tryRestore: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const restore = async () => {
      const saved = await loadState();
      if (cancelled || !saved) return;

      currentPageRef.current = saved.currentPage;
      currentZoomRef.current = saved.currentZoom;
      currentScrollRef.current = saved.currentScroll;

      const attempt = () => {
        if (cancelled) return;

        const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
        const zoomPlugin = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
        const docManager = registry.getPlugin("document-manager")?.provides();
        const doc = docManager?.getActiveDocument();
        const documentId = doc?.id;
        const totalPages = scroll?.getTotalPages() ?? 0;

        if (!scroll || !doc || !documentId || totalPages === 0) {
          tryRestore = setTimeout(attempt, 300);
          return;
        }

        restoredRef.current = true;
        if (tryRestore) {
          clearTimeout(tryRestore);
          tryRestore = null;
        }

        const docScroll = scroll.forDocument(documentId);

        if (saved.currentZoom) {
          const docZoom = zoomPlugin?.forDocument(documentId);
          docZoom?.requestZoom(saved.currentZoom);
        }

        setTimeout(() => {
          docScroll?.scrollToPage({
            pageNumber: saved.currentPage,
            pageCoordinates:
              saved.currentScroll > 0
                ? { x: 0, y: saved.currentScroll }
                : undefined,
            behavior: "instant",
          });
        }, 350);

        if (saved.annotations) {
          try {
            const annotation = registry.getPlugin("annotation")?.provides();
            const parsed = JSON.parse(saved.annotations);

            if (Array.isArray(parsed) && parsed.length > 0 && annotation) {
              const docAnnotation = annotation.forDocument(documentId);

              if (docAnnotation?.createAnnotation) {
                for (const ann of parsed) {
                  if (ann.pageIndex !== undefined && ann.id && ann.rect) {
                    try {
                      docAnnotation.createAnnotation(ann.pageIndex, ann);
                    } catch (error) {
                      console.error("Failed to create annotation:", ann.id, error);
                    }
                  }
                }
                docAnnotation?.commit();
              }
            }
          } catch (error) {
            console.error("Failed to restore annotations:", error);
          }
        }
      };

      attempt();
    };

    void restore();

    return () => {
      cancelled = true;
      if (tryRestore) clearTimeout(tryRestore);
    };
  }, [fileHash, loadState, registry]);

  useEffect(() => {
    if (!registry) return;

    const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
    const zoomPlugin = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
    const cleanups: Array<() => void> = [];

    if (scroll) {
      cleanups.push(
        scroll.onPageChange((event) => {
          currentPageRef.current = event.pageNumber;
          scheduleSave({
            currentPage: event.pageNumber,
            currentZoom: currentZoomRef.current,
            currentScroll: currentScrollRef.current,
          });
        }),
      );

      cleanups.push(
        scroll.onScroll((event) => {
          currentPageRef.current = event.metrics.currentPage;
          currentScrollRef.current = event.metrics.scrollOffset.y;
          scheduleSave({
            currentPage: event.metrics.currentPage,
            currentZoom: currentZoomRef.current,
            currentScroll: event.metrics.scrollOffset.y,
          });
        }),
      );
    }

    if (zoomPlugin) {
      cleanups.push(
        zoomPlugin.onStateChange((event) => {
          currentZoomRef.current = event.state.currentZoomLevel;
          scheduleSave({
            currentPage: currentPageRef.current,
            currentZoom: event.state.currentZoomLevel,
            currentScroll: currentScrollRef.current,
          });
        }),
      );
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [registry, scheduleSave]);

  useEffect(() => {
    const save = async () => {
      const reg = registryRef.current;
      const hash = fileHashRef.current;
      const engine = engineRef.current;
      if (!reg || !hash || !engine) return;

      const scroll = reg.getPlugin("scroll")?.provides();
      const zoomPlugin = reg.getPlugin("zoom")?.provides();
      const docManager = reg.getPlugin("document-manager")?.provides();
      const doc = docManager?.getActiveDocument();

      if (!doc || (scroll?.getTotalPages() ?? 0) === 0) return;

      const currentPage = currentPageRef.current || 1;
      const currentZoom = zoomPlugin?.getState()?.currentZoomLevel ?? currentZoomRef.current;
      const currentScroll =
        scroll?.getMetrics()?.scrollOffset.y ?? currentScrollRef.current;
      const pageAnnotations: any[] = [];

      try {
        const totalPages = scroll?.getTotalPages() ?? 0;
        for (let i = 0; i < totalPages; i++) {
          const page = doc.pages[i];
          const anns = await engine.getPageAnnotations(doc, page).toPromise();
          pageAnnotations.push(...(anns || []));
        }
      } catch (error) {
        console.error("Failed to get annotations:", error);
      }

      currentZoomRef.current = currentZoom;
      currentScrollRef.current = currentScroll;

      await saveNow({
        currentPage,
        currentZoom,
        currentScroll,
        annotations: JSON.stringify(pageAnnotations),
      });
    };

    const interval = setInterval(() => {
      void save();
    }, 5000);

    const handleBeforeUnload = () => {
      void save();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void save();
    };
  }, [saveNow]);
}
