import { useCallback, useEffect, useRef, useState } from "react";

const BATCH_SIZE = 24;

export function thumbKey(path: string, pageIndex: number) {
  return `${path}#${pageIndex}`;
}

/**
 * Collects thumbnail requests from visible page cards (across any number of
 * PDFs) and fetches them per file in batches, so a long document never opens
 * hundreds of render jobs at once.
 */
export function usePdfThumbnails() {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const pendingRef = useRef(new Map<string, Set<number>>());
  const requestedRef = useRef(new Set<string>());
  const runningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (mountedRef.current) {
        const next = Array.from(pendingRef.current.entries()).find(([, pages]) => pages.size > 0);
        if (!next) break;
        const [path, pages] = next;
        const batch = Array.from(pages).sort((a, b) => a - b).slice(0, BATCH_SIZE);
        batch.forEach((page) => pages.delete(page));
        const result = await window.api.getToolPdfThumbnails(path, batch.map((page) => page + 1)).catch(() => null);
        if (!mountedRef.current || !result) continue;
        setThumbs((current) => {
          const updated = { ...current };
          for (const thumb of result.thumbnails) updated[thumbKey(path, thumb.page - 1)] = thumb.dataUrl;
          return updated;
        });
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  const request = useCallback((path: string, pageIndex: number) => {
    const key = thumbKey(path, pageIndex);
    if (requestedRef.current.has(key)) return;
    requestedRef.current.add(key);
    const pages = pendingRef.current.get(path) ?? new Set<number>();
    pages.add(pageIndex);
    pendingRef.current.set(path, pages);
    if (timerRef.current === null) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void pump();
      }, 60);
    }
  }, [pump]);

  return { thumbs, request };
}
