import {
  PluginRegistry,
  ScrollPlugin,
  ZoomPlugin,
} from "@embedpdf/react-pdf-viewer";
import { useEffect, useRef } from "react";

export default function useReadingPersistence(
  registry: PluginRegistry | null,
  fileHash: string,
) {
  const registryRef = useRef(registry);
  const fileHashRef = useRef(fileHash);
  const currentPageRef = useRef(1);
  const restoredRef = useRef(false);
  const engineRef = useRef<any>(null);

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

    const restore = async () => {
      const saved = await window.api.getReadingState(fileHash);
      if (!saved) return;

      const savedPage = typeof saved.currentPage === 'object' ? saved.currentPage.pageNumber : saved.currentPage;

      let attempts = 0;
      const tryRestore = setInterval(async () => {
        attempts++;

        const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
        const zoomPlugin = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
        const docManager = registry.getPlugin("document-manager")?.provides();
        const doc = docManager?.getActiveDocument();
        const documentId = doc?.id;

        const totalPages = scroll?.getTotalPages() ?? 0;

        if (!scroll || !doc || totalPages === 0) {
          if (attempts >= 30) {
            clearInterval(tryRestore);
          }
          return;
        }

        if (restoredRef.current) {
          clearInterval(tryRestore);
          return;
        }
        restoredRef.current = true;
        clearInterval(tryRestore);

        if (savedPage > 1 && documentId) {
          setTimeout(() => {
            const docScroll = scroll.forDocument(documentId);
            docScroll?.scrollToPage({ pageNumber: savedPage });
          }, 500);
        }

        if (saved.currentZoom && documentId) {
          const docZoom = zoomPlugin?.forDocument(documentId);
          docZoom?.requestZoom(saved.currentZoom);
        }

        if (saved.annotations && documentId) {
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
                    } catch (e) {
                      console.error("Failed to create annotation:", ann.id, e);
                    }
                  }
                }
                docAnnotation?.commit();
              }
            }
          } catch (e) {
            console.error("Failed to restore annotations:", e);
          }
        }
      }, 300);
    };

    restore();
  }, [registry, fileHash]);

  useEffect(() => {
    if (!registry) return;

    const scroll = registry.getPlugin("scroll")?.provides();
    if (!scroll) return;

    const unsub = scroll.onPageChange((event: { pageNumber: number }) => {
      currentPageRef.current = event.pageNumber;
    });

    return () => unsub?.();
  }, [registry]);

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

      const rawPage = currentPageRef.current as number | { pageNumber: number } | null | undefined;
      const pageValue = rawPage || 1;
      const currentPage = typeof pageValue === 'object' 
        ? pageValue.pageNumber 
        : pageValue;
      const currentZoom = zoomPlugin?.getState()?.currentZoomLevel ?? 1;
      const pageAnnotations: any[] = [];

      try {
        const totalPages = scroll?.getTotalPages() ?? 0;
        for (let i = 0; i < totalPages; i++) {
          const page = doc.pages[i];
          const anns = await engine.getPageAnnotations(doc, page).toPromise();
          pageAnnotations.push(...(anns || []));
        }
      } catch (e) {
        console.error("Failed to get annotations:", e);
      }

      window.api.saveReadingState({
        fileHash: hash,
        state: {
          currentPage: currentPage,
          currentZoom: currentZoom,
          currentScroll: 0,
          annotations: JSON.stringify(pageAnnotations),
        },
      });
    };

    const interval = setInterval(save, 5000);
    window.addEventListener("beforeunload", save);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);
}
