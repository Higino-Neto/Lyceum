import type { ReaderPoint } from "./readerModel";
export interface PdfVisualAnchor { page: number; x: number; y: number; screen: ReaderPoint }
export function relativePoint(rect: { left: number; top: number; width: number; height: number }, point: ReaderPoint) {
  return { x: (point.x - rect.left) / Math.max(1, rect.width), y: (point.y - rect.top) / Math.max(1, rect.height) };
}
export function capturePdfAnchor(container: HTMLElement, point?: ReaderPoint): PdfVisualAnchor | undefined {
  const view = container.getBoundingClientRect();
  const screen = point || { x: view.left + view.width / 2, y: view.top + view.height / 2 };
  const pages = [...container.querySelectorAll<HTMLElement>(".page[data-page-number]")];
  const page = pages.filter(p => p.getBoundingClientRect().height > 0).sort((a, b) => {
    const distance = (p: HTMLElement) => { const r = p.getBoundingClientRect(); return Math.max(r.top - screen.y, screen.y - r.bottom, 0); };
    return distance(a) - distance(b);
  })[0];
  if (!page) return;
  return { page: Number(page.dataset.pageNumber), ...relativePoint(page.getBoundingClientRect(), screen), screen };
}
export function restorePdfAnchor(container: HTMLElement, anchor?: PdfVisualAnchor) {
  if (!anchor) return;
  const page = container.querySelector<HTMLElement>(`.page[data-page-number="${anchor.page}"]`);
  if (!page) return;
  const r = page.getBoundingClientRect();
  container.scrollLeft += r.left + anchor.x * r.width - anchor.screen.x;
  container.scrollTop += r.top + anchor.y * r.height - anchor.screen.y;
}
