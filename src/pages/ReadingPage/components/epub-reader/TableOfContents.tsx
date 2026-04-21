import { List, X } from "lucide-react";
import type { NavItem } from "./ViewerCore";

interface TableOfContentsProps {
  isOpen: boolean;
  toc: NavItem[];
  currentHref?: string;
  onSelectChapter: (href: string) => void;
  onClose: () => void;
}

function flattenToc(items: NavItem[], level = 0): Array<{ item: NavItem; level: number }> {
  const result: Array<{ item: NavItem; level: number }> = [];
  for (const item of items) {
    result.push({ item, level });
    if (item.subitems?.length) {
      result.push(...flattenToc(item.subitems, level + 1));
    }
  }
  return result;
}

function decodeHtmlEntities(text: string): string {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent || text;
}

export default function TableOfContents({
  isOpen,
  toc,
  currentHref,
  onSelectChapter,
  onClose,
}: TableOfContentsProps) {
  const flattened = flattenToc(toc);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl lg:w-80">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 text-zinc-100">
          <List size={18} />
          <span className="font-medium">Índice</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Fechar índice"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain py-2">
        {flattened.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Sem capítulos disponíveis
          </div>
        ) : (
          <ul className="space-y-0.5">
            {flattened.map(({ item, level }) => {
              const isActive = currentHref
                ? decodeURIComponent(currentHref).includes(decodeURIComponent(item.href))
                : false;

              return (
                <li key={item.id || item.href}>
                  <button
                    type="button"
                    onClick={() => onSelectChapter(item.href)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-zinc-800 ${
                      isActive
                        ? "bg-zinc-800/50 text-amber-200"
                        : "text-zinc-300"
                    }`}
                    style={{ paddingLeft: `${level * 16 + 16}px` }}
                    title={decodeHtmlEntities(item.label)}
                  >
                    <span className="line-clamp-2">
                      {decodeHtmlEntities(item.label)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}