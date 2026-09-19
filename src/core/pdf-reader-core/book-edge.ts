interface SectionNode { page: number | null; title: string; items?: SectionNode[] }

/** Geometry uses page boundaries so chapter lengths remain proportional. */
export function edgePage(fraction: number, total: number): number {
  return Math.max(1, Math.min(total, Math.floor(Math.max(0, fraction) * total) + 1));
}

export function rifflePages(page: number, total: number, count: number): number[] {
  const size = Math.min(total, count);
  const first = Math.max(1, Math.min(page - Math.floor(size / 2), total - size + 1));
  return Array.from({ length: size }, (_, index) => first + index);
}

export function bookSections(outline: SectionNode[], total: number) {
  const usable = (items: typeof outline): typeof outline => items.flatMap(item =>
    item.page && item.page >= 1 && item.page <= total ? [item] : usable(item.items ?? []));
  const starts = [...new Map(usable(outline).sort((a, b) => a.page! - b.page!).map(item => [item.page, item])).values()];
  if (!starts.length || starts[0]?.page !== 1) starts.unshift({ page: 1, title: starts.length ? "Início" : "Livro" });
  return starts.map((item, index) => ({ title: item.title, page: item.page!, end: (starts[index + 1]?.page ?? total + 1) - 1 }));
}
