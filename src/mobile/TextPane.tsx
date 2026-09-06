import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ReaderTools, useReaderHistory } from "./ReaderTools";
import { useReaderData } from "./ReaderData";
import type { ReaderLocator } from "./readerModel";
import { FONT_MAP, THEME_COLORS, loadSettings, persistSettings, type FontFamily, type ReaderTheme } from "./textReaderSettings";

export default function TextPane({ bookId, dataUrl, initialProgress, initialOffset, onProgress }: {
  bookId: string; dataUrl: string; initialProgress: number; initialOffset?: number; onProgress: (percent: number, offset: number) => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(loadSettings);
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState(0);
  const [selection, setSelection] = useState<{ text: string; locator: ReaderLocator }>();
  const viewport = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLPreElement>(null);
  const offsetRef = useRef(initialOffset || 0);
  const restored = useRef(false);
  const { data } = useReaderData();
  const marks = data.annotations.filter(a => a.bookId === bookId && !a.deletedAt && a.type !== "bookmark" && a.locator.format === "txt");
  const hits = useMemo(() => {
    const found: number[] = []; if (query.length < 2) return found;
    const body = content.toLocaleLowerCase(), needle = query.toLocaleLowerCase();
    let start = 0; while (found.length < 1000) { const index = body.indexOf(needle, start); if (index < 0) break; found.push(index); start = index + Math.max(1, needle.length); }
    return found;
  }, [content, query]);
  const navigate = (locator: ReaderLocator) => {
    if (locator.format !== "txt" || !text.current || !viewport.current) return;
    const offset = Math.min(content.length, locator.offset);
    offsetRef.current = offset;
    const walker = document.createTreeWalker(text.current, NodeFilter.SHOW_TEXT);
    let count = 0, node: Node | null;
    while ((node = walker.nextNode())) {
      if (count + (node.textContent?.length || 0) >= offset) {
        const range = document.createRange(); range.setStart(node, offset - count); range.setEnd(node, Math.min((node.textContent?.length || 0), offset - count + 1));
        const rect = range.getBoundingClientRect(), view = viewport.current.getBoundingClientRect();
        viewport.current.scrollTop += rect.top - view.top - 12;
        break;
      }
      count += node.textContent?.length || 0;
    }
  };
  const history = useReaderHistory({ format: "txt", offset: offsetRef.current }, navigate);
  useEffect(() => {
    const controller = new AbortController();
    fetch(dataUrl, { signal: controller.signal }).then(r => r.text()).then(setContent).catch(e => { if (e.name !== "AbortError") setError("Não foi possível ler este TXT."); });
    return () => controller.abort();
  }, [dataUrl]);
  useLayoutEffect(() => {
    if (!content) return;
    if (!restored.current) { offsetRef.current = initialOffset ?? Math.round(content.length * initialProgress / 100); restored.current = true; }
    navigate({ format: "txt", offset: offsetRef.current });
    // Stable character position survives font and theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings]);
  useEffect(() => {
    persistSettings(settings);
  }, [settings]);
  useEffect(() => {
    const resized = () => navigate({ format: "txt", offset: offsetRef.current });
    window.addEventListener("resize", resized); return () => window.removeEventListener("resize", resized);
  });
  const selected = () => {
    const s = window.getSelection(); if (!s?.rangeCount || !s.toString().trim() || !text.current) return;
    const range = s.getRangeAt(0); if (!text.current.contains(range.startContainer) || !text.current.contains(range.endContainer)) return;
    const prefix = range.cloneRange(); prefix.selectNodeContents(text.current); prefix.setEnd(range.startContainer, range.startOffset);
    const offset = prefix.toString().length;
    setSelection({ text: s.toString(), locator: { format: "txt", offset, end: offset + s.toString().length } });
  };
  const boundaries = new Set([0, content.length]);
  for (let i = 0; i < content.length; i += 800) boundaries.add(i);
  marks.forEach(a => { if (a.locator.format === "txt") { boundaries.add(Math.min(content.length, a.locator.offset)); boundaries.add(Math.min(content.length, a.locator.end || a.locator.offset)); } });
  if (hits[hit] !== undefined) { boundaries.add(hits[hit]); boundaries.add(hits[hit] + query.length); }
  const points = [...boundaries].sort((a, b) => a - b);
  const cls = "rounded-lg bg-zinc-800 p-2 text-sm text-white";
  return <div className="relative">
    <div className="flex flex-wrap gap-2 p-2">
      <select aria-label="Tema" className={cls} value={settings.theme} onChange={e => setSettings(s => ({ ...s, theme: e.target.value as ReaderTheme }))}>{Object.keys(THEME_COLORS).map(t => <option key={t}>{t}</option>)}</select>
      <select aria-label="Fonte" className={cls} value={settings.fontFamily} onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value as FontFamily }))}>{Object.keys(FONT_MAP).map(t => <option key={t}>{t}</option>)}</select>
      <button className={cls} onClick={() => setSettings(s => ({ ...s, fontSize: Math.max(60, s.fontSize - 10) }))}>A−</button><button className={cls} onClick={() => setSettings(s => ({ ...s, fontSize: Math.min(200, s.fontSize + 10) }))}>A+</button>
      <input className={cls} placeholder="Buscar no TXT" value={query} onChange={e => { setQuery(e.target.value); setHit(0); }} />
      <button className={cls} disabled={!hits.length} onClick={() => { const next = (hit + 1) % hits.length; setHit(next); history.jump({ format: "txt", offset: hits[next] }); }}>{hits.length ? `${hit + 1}/${hits.length} · Próximo` : "Sem resultados"}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div ref={viewport} className="h-[65dvh] overflow-auto p-5" style={{ background: THEME_COLORS[settings.theme].background, color: THEME_COLORS[settings.theme].foreground }} onMouseUp={selected} onTouchEnd={selected} onScroll={() => {
      const view = viewport.current; if (!view) return;
      const top = view.getBoundingClientRect().top + 12;
      const visible = [...(text.current?.querySelectorAll<HTMLElement>("[data-offset]") || [])].find(el => el.getBoundingClientRect().bottom >= top);
      if (visible) offsetRef.current = Number(visible.dataset.offset) || 0;
      const atEnd = view.scrollHeight > view.clientHeight && view.scrollTop + view.clientHeight >= view.scrollHeight - 2;
      onProgress(atEnd ? 100 : Math.min(100, Math.round(offsetRef.current / Math.max(1, content.length) * 100)), offsetRef.current);
    }}>
      <pre ref={text} className="whitespace-pre-wrap" style={{ fontFamily: FONT_MAP[settings.fontFamily], fontSize: `${settings.fontSize}%`, lineHeight: settings.lineHeight }}>{points.slice(0, -1).map((start, i) => {
        const mark = marks.find(a => a.locator.format === "txt" && a.locator.offset <= start && (a.locator.end || 0) > start);
        return <span key={start} data-offset={start} style={{ background: hits[hit] === start ? "#86efac" : mark?.color, color: mark ? "#18181b" : undefined }}>{content.slice(start, points[i + 1])}</span>;
      })}</pre>
    </div>
    <ReaderTools onTurn={direction => { viewport.current?.scrollBy({ top: direction * viewport.current.clientHeight * 0.9, behavior: "smooth" }); }} bookId={bookId} locator={{ format: "txt", offset: offsetRef.current }} selection={selection} clearSelection={() => { setSelection(undefined); window.getSelection()?.removeAllRanges(); }} navigate={navigate} history={history} getText={async () => content} />
  </div>;
}
