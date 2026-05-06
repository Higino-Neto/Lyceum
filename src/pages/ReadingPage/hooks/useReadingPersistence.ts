import {
  AnnotationPlugin,
  DocumentManagerPlugin,
  PluginRegistry,
  ScrollPlugin,
  ViewportPlugin,
  ZoomPlugin,
} from "@embedpdf/react-pdf-viewer";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { useCallback, useEffect, useRef } from "react";
import useReadingStatePersistence from "./useReadingStatePersistence";

const PDF_ANNOTATIONS_KIND = "lyceum-pdf-annotations";

interface PdfPositionSnapshot {
  documentId: string;
  currentPage: number;
  currentZoom: number;
  currentScroll: number;
  totalPages: number;
}

interface PersistedPdfAnnotations {
  kind: typeof PDF_ANNOTATIONS_KIND;
  version: 1;
  annotations: PdfAnnotationObject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPersistableAnnotation(value: unknown): value is PdfAnnotationObject {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.pageIndex === "number" &&
    isRecord(value.rect)
  );
}

function parsePdfAnnotations(raw: string | null | undefined): PdfAnnotationObject[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter(isPersistableAnnotation);
    }

    if (isRecord(parsed) && Array.isArray(parsed.annotations)) {
      return parsed.annotations.filter(isPersistableAnnotation);
    }
  } catch {
    // Ignore corrupt annotation payloads and keep the PDF readable.
  }

  return [];
}

function serializePdfAnnotations(annotations: PdfAnnotationObject[]) {
  const payload: PersistedPdfAnnotations = {
    kind: PDF_ANNOTATIONS_KIND,
    version: 1,
    annotations,
  };

  return JSON.stringify(payload);
}

function clampPage(page: number, totalPages: number) {
  const fallbackTotal = Math.max(1, totalPages || 1);
  return Math.min(fallbackTotal, Math.max(1, Math.round(page || 1)));
}

function sortAnnotations(annotations: PdfAnnotationObject[]) {
  return [...annotations].sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }

    return left.id.localeCompare(right.id);
  });
}

export default function useReadingPersistence(
  registry: PluginRegistry | null,
  fileHash: string,
) {
  const registryRef = useRef(registry);
  const currentPageRef = useRef(1);
  const currentZoomRef = useRef(1);
  const currentScrollRef = useRef(0);
  const lastAnnotationsRef = useRef("[]");
  const isRestoringRef = useRef(false);
  const restoreTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

  const clearRestoreTimeouts = useCallback(() => {
    restoreTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    restoreTimeoutsRef.current = [];
  }, []);

  const readPositionSnapshot = useCallback(
    (targetRegistry = registryRef.current): PdfPositionSnapshot | null => {
      if (!targetRegistry) {
        return null;
      }

      try {
        const documentManager = targetRegistry
          .getPlugin<DocumentManagerPlugin>("document-manager")
          ?.provides();
        const document = documentManager?.getActiveDocument();

        if (!document?.id) {
          return null;
        }

        const documentId = document.id;
        const scroll = targetRegistry.getPlugin<ScrollPlugin>("scroll")?.provides();
        const viewport = targetRegistry
          .getPlugin<ViewportPlugin>("viewport")
          ?.provides();
        const zoom = targetRegistry.getPlugin<ZoomPlugin>("zoom")?.provides();
        const scrollScope = scroll?.forDocument(documentId);
        const viewportScope = viewport?.forDocument(documentId);
        const zoomScope = zoom?.forDocument(documentId);
        const scrollMetrics = scrollScope?.getMetrics();
        const viewportMetrics = viewportScope?.getMetrics();
        const totalPages =
          scrollScope?.getTotalPages() ?? scroll?.getTotalPages() ?? document.pageCount ?? 0;
        const currentPage =
          scrollMetrics?.currentPage ?? scrollScope?.getCurrentPage() ?? currentPageRef.current;
        const currentZoom =
          zoomScope?.getState().currentZoomLevel ??
          zoom?.getState().currentZoomLevel ??
          currentZoomRef.current;
        const currentScroll =
          viewportMetrics?.scrollTop ??
          scrollMetrics?.scrollOffset.y ??
          currentScrollRef.current;

        return {
          documentId,
          currentPage: clampPage(currentPage, totalPages),
          currentZoom: Number.isFinite(currentZoom) && currentZoom > 0 ? currentZoom : 1,
          currentScroll: Number.isFinite(currentScroll) && currentScroll > 0 ? currentScroll : 0,
          totalPages,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const savePositionSnapshot = useCallback(
    (mode: "now" | "schedule") => {
      const snapshot = readPositionSnapshot();
      if (!snapshot) {
        return;
      }

      currentPageRef.current = snapshot.currentPage;
      currentZoomRef.current = snapshot.currentZoom;
      currentScrollRef.current = snapshot.currentScroll;

      const nextState = {
        currentPage: snapshot.currentPage,
        currentZoom: snapshot.currentZoom,
        currentScroll: snapshot.currentScroll,
        annotations: lastAnnotationsRef.current,
      };

      if (mode === "now") {
        void saveNow(nextState);
        return;
      }

      scheduleSave(nextState);
    },
    [readPositionSnapshot, saveNow, scheduleSave],
  );

  const collectAnnotations = useCallback(
    (
      targetRegistry = registryRef.current,
      targetDocumentId?: string,
    ) => {
      if (!targetRegistry || !targetDocumentId) {
        return parsePdfAnnotations(lastAnnotationsRef.current);
      }

      const annotation = targetRegistry
        .getPlugin<AnnotationPlugin>("annotation")
        ?.provides();

      if (!annotation) {
        return parsePdfAnnotations(lastAnnotationsRef.current);
      }

      const scope = annotation.forDocument(targetDocumentId);
      const annotations = Object.values(scope.getState().byUid)
        .map((tracked) => tracked.object)
        .filter(isPersistableAnnotation);

      return sortAnnotations(annotations);
    },
    [],
  );

  const saveFullSnapshot = useCallback(
    (mode: "now" | "schedule") => {
      const snapshot = readPositionSnapshot();
      if (!snapshot) {
        return;
      }

      const annotations = collectAnnotations(
        registryRef.current,
        snapshot.documentId,
      );
      lastAnnotationsRef.current = serializePdfAnnotations(annotations);
      currentPageRef.current = snapshot.currentPage;
      currentZoomRef.current = snapshot.currentZoom;
      currentScrollRef.current = snapshot.currentScroll;

      const nextState = {
        currentPage: snapshot.currentPage,
        currentZoom: snapshot.currentZoom,
        currentScroll: snapshot.currentScroll,
        annotations: lastAnnotationsRef.current,
      };

      if (mode === "now") {
        void saveNow(nextState);
        return;
      }

      scheduleSave(nextState);
    },
    [collectAnnotations, readPositionSnapshot, saveNow, scheduleSave],
  );

  const restoreAnnotations = useCallback(
    (targetRegistry: PluginRegistry, documentId: string, rawAnnotations: string) => {
      const annotations = parsePdfAnnotations(rawAnnotations);
      if (annotations.length === 0) {
        return;
      }

      const annotation = targetRegistry
        .getPlugin<AnnotationPlugin>("annotation")
        ?.provides();
      if (!annotation) {
        return;
      }

      const scope = annotation.forDocument(documentId);
      const existingIds = new Set([
        ...Object.keys(scope.getState().byUid),
        ...Object.values(scope.getState().byUid).map((tracked) => tracked.object.id),
      ]);
      const missingAnnotations = annotations.filter(
        (annotationObject) => !existingIds.has(annotationObject.id),
      );

      if (missingAnnotations.length === 0) {
        return;
      }

      try {
        scope.importAnnotations(
          missingAnnotations.map((annotationObject) => ({
            annotation: annotationObject,
          })),
        );
        void scope.commit().toPromise().catch((error) => {
          console.error("Failed to commit restored PDF annotations:", error);
        });
      } catch (error) {
        console.error("Failed to restore PDF annotations:", error);
      }
    },
    [],
  );

  const restorePosition = useCallback(
    (
      targetRegistry: PluginRegistry,
      documentId: string,
      saved: {
        currentPage: number;
        currentZoom: number;
        currentScroll: number;
      },
      totalPages: number,
    ) => {
      const scroll = targetRegistry.getPlugin<ScrollPlugin>("scroll")?.provides();
      const viewport = targetRegistry.getPlugin<ViewportPlugin>("viewport")?.provides();
      const zoom = targetRegistry.getPlugin<ZoomPlugin>("zoom")?.provides();
      let scrollScope: ReturnType<NonNullable<typeof scroll>["forDocument"]> | undefined;
      let viewportScope: ReturnType<NonNullable<typeof viewport>["forDocument"]> | undefined;
      let zoomScope: ReturnType<NonNullable<typeof zoom>["forDocument"]> | undefined;

      try {
        scrollScope = scroll?.forDocument(documentId);
        viewportScope = viewport?.forDocument(documentId);
        zoomScope = zoom?.forDocument(documentId);
      } catch {
        isRestoringRef.current = false;
        return;
      }

      const targetPage = clampPage(saved.currentPage, totalPages);
      const targetScroll = Math.max(0, saved.currentScroll || 0);

      clearRestoreTimeouts();
      isRestoringRef.current = true;

      if (saved.currentZoom > 0) {
        zoomScope?.requestZoom(saved.currentZoom);
      }

      const checkpoints = [0, 120, 320, 700, 1200];
      checkpoints.forEach((delay, index) => {
        const timeoutId = setTimeout(() => {
          if (targetScroll > 0) {
            viewportScope?.scrollTo({
              x: 0,
              y: targetScroll,
              behavior: "instant",
            });
          } else {
            scrollScope?.scrollToPage({
              pageNumber: targetPage,
              behavior: "instant",
            });
          }

          if (index === checkpoints.length - 1) {
            isRestoringRef.current = false;
          }
        }, delay);

        restoreTimeoutsRef.current.push(timeoutId);
      });
    },
    [clearRestoreTimeouts],
  );

  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  useEffect(() => {
    lastAnnotationsRef.current = "[]";
    currentPageRef.current = 1;
    currentZoomRef.current = 1;
    currentScrollRef.current = 0;
    isRestoringRef.current = false;
    clearRestoreTimeouts();
  }, [clearRestoreTimeouts, fileHash]);

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
      lastAnnotationsRef.current = saved.annotations || "[]";

      const attempt = () => {
        if (cancelled) return;

        const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
        const documentManager = registry
          .getPlugin<DocumentManagerPlugin>("document-manager")
          ?.provides();
        const document = documentManager?.getActiveDocument();
        const documentId = document?.id;
        let totalPages = 0;

        try {
          totalPages = documentId
            ? scroll?.forDocument(documentId).getTotalPages() ?? 0
            : 0;
        } catch {
          totalPages = 0;
        }

        if (!scroll || !document || !documentId || totalPages === 0) {
          tryRestore = setTimeout(attempt, 300);
          return;
        }

        if (tryRestore) {
          clearTimeout(tryRestore);
          tryRestore = null;
        }

        restorePosition(registry, documentId, saved, totalPages);
        restoreAnnotations(registry, documentId, saved.annotations);
      };

      attempt();
    };

    void restore();

    return () => {
      cancelled = true;
      if (tryRestore) clearTimeout(tryRestore);
    };
  }, [fileHash, loadState, registry, restoreAnnotations, restorePosition]);

  useEffect(() => {
    if (!registry) return;

    const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
    const zoomPlugin = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
    const annotation = registry
      .getPlugin<AnnotationPlugin>("annotation")
      ?.provides();
    const cleanups: Array<() => void> = [];

    if (scroll) {
      cleanups.push(
        scroll.onPageChange((event) => {
          if (isRestoringRef.current) return;
          currentPageRef.current = event.pageNumber;
          savePositionSnapshot("schedule");
        }),
      );

      cleanups.push(
        scroll.onScroll((event) => {
          if (isRestoringRef.current) return;
          currentPageRef.current = event.metrics.currentPage;
          currentScrollRef.current = event.metrics.scrollOffset.y;
          savePositionSnapshot("schedule");
        }),
      );
    }

    if (zoomPlugin) {
      cleanups.push(
        zoomPlugin.onStateChange((event) => {
          if (isRestoringRef.current) return;
          currentZoomRef.current = event.state.currentZoomLevel;
          savePositionSnapshot("schedule");
        }),
      );
    }

    if (annotation) {
      cleanups.push(
        annotation.onAnnotationEvent((event) => {
          if (isRestoringRef.current || event.type === "loaded") return;
          void saveFullSnapshot("now");
        }),
      );
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [registry, saveFullSnapshot, savePositionSnapshot]);

  useEffect(() => {
    const interval = setInterval(() => {
      savePositionSnapshot("now");
    }, 15000);

    const handleBeforeUnload = () => {
      void saveFullSnapshot("now");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearRestoreTimeouts();
      void saveFullSnapshot("now");
    };
  }, [clearRestoreTimeouts, saveFullSnapshot, savePositionSnapshot]);
}
