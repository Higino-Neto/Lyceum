import type { Rendition, Location } from "epubjs";
export interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface SearchHit {
  cfi: string;
  href: string;
  label: string;
  excerpt: string;
}


export type EpubRendition = Omit<Rendition, "currentLocation"> & { currentLocation(): Location };
export interface EpubSection {
  document?: Document; label?: string; href: string; url: string; cfiBase: string;
  load(request: (url: string) => Promise<Document>): Promise<Document>;
  search?(query: string): { cfi: string; excerpt?: string }[];
  find?(query: string): { cfi: string; excerpt?: string }[];
  unload(): void;
}
export interface EpubBook {
  ready: Promise<void>; destroy(): void; load(url: string): Promise<Document>;
  loaded: { navigation: Promise<{ toc: TocItem[] }> };
  locations: { generate(size: number): Promise<void>; percentageFromCfi(cfi: string): number };
  spine: { spineItems: EpubSection[] };
  renderTo(element: HTMLElement, options: Parameters<Rendition["book"]["renderTo"]>[1]): EpubRendition;
}
