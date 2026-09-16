/* eslint-disable react-refresh/only-export-components */
import { ReaderControls, defaultReaderControls, hasNativeReaderControls, type ReaderControlSettings } from "./readerControls";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import toast from "react-hot-toast";
import { appendHistory, type ReaderLocator } from "./readerModel";

export async function downloadMobileText(name: string, text: string, mime = "text/plain") {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({ path: `Lyceum/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    toast.success(`Salvo em Documentos/Lyceum: ${name}`);
    return result.uri;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
}

export function useReaderHistory(current: ReaderLocator, navigate: (locator: ReaderLocator) => void) {
  const [history, setHistory] = useState({ items: [current], index: 0 });
  const record = (target: ReaderLocator) => {
    setHistory(h => { const origin = appendHistory(h.items, h.index, current); return appendHistory(origin.items, origin.index, target); });
  };
  const jump = (target: ReaderLocator) => { record(target); navigate(target); };
  const step = (direction: number) => {
    const index = Math.max(0, Math.min(history.items.length - 1, history.index + direction));
    navigate(history.items[index]); setHistory(h => ({ ...h, index }));
  };
  return { ...history, record, jump, step };
}

export function ReaderTools({ bookId, onTurn }: {
  bookId?: string; locator?: ReaderLocator; selection?: { locator: ReaderLocator; text: string }; clearSelection?: () => void;
  navigate?: (target: ReaderLocator) => void; getText?: () => Promise<string>;
  onTurn?: (direction: number) => void;
  history?: ReturnType<typeof useReaderHistory>;
}) {
  const [controls, setControls] = useState<ReaderControlSettings>(() => { try { return { ...defaultReaderControls, ...JSON.parse(localStorage.getItem("lyceum-reader-controls") || "{}") }; } catch { return defaultReaderControls; } });
  const turnRef = useRef(onTurn); turnRef.current = onTurn;
  const brightnessTouch = useRef(0);
  const native = hasNativeReaderControls();
  useEffect(() => {
    if (!bookId) return;
    try { localStorage.setItem("lyceum-reader-controls", JSON.stringify(controls)); } catch { /* Settings remain usable. */ }
    if (!native) return;
    const apply = () => { if (!document.hidden) void ReaderControls.configure(controls).catch(() => toast.error("Os controles Android não estão disponíveis.")); };
    apply(); document.addEventListener("visibilitychange", apply);
    return () => { document.removeEventListener("visibilitychange", apply); void ReaderControls.configure(defaultReaderControls).catch(() => undefined); };
  }, [controls, native, bookId]);
  useEffect(() => {
    if (!native || !bookId) return;
    const listener = ReaderControls.addListener("pageTurn", e => { turnRef.current?.(e.direction); navigator.vibrate?.(10); });
    return () => { void listener.then(l => l.remove()); };
  }, [native, bookId]);
  // Text selection is intentionally left to the platform (copy/share). Lyceum no
  // longer interrupts it with a note/highlight prompt; bookmarks live in the
  // reader's top bar instead.
  return <div onClick={e => e.stopPropagation()}>
    {bookId && controls.tapZones && onTurn && <><button className="absolute bottom-[25%] left-0 z-20 h-[40%] w-[6%]" aria-label="Página anterior" onClick={() => onTurn(-1)} /><button className="absolute bottom-[25%] right-0 z-20 h-[40%] w-[6%]" aria-label="Próxima página" onClick={() => onTurn(1)} /></>}
    {bookId && native && <div className="absolute bottom-[25%] left-0 z-30 h-[40%] w-3 touch-none" onTouchStart={e => { brightnessTouch.current = e.touches[0].clientY; }} onTouchMove={e => { const y = e.touches[0].clientY; const delta = (brightnessTouch.current - y) / 400; brightnessTouch.current = y; setControls(c => ({ ...c, brightness: Math.max(0.1, Math.min(1, (c.brightness < 0 ? 1 : c.brightness) + delta)) })); }} />}
  </div>;
}
