/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import toast from "react-hot-toast";
import { emptyReaderData, migrateReaderData, type ReaderAnnotation, type ReaderData, type ReaderLocator } from "./readerModel";
import { makeMobileId } from "./storage";

const KEY = "lyceum_mobile_reader_data";
const Context = createContext<{
  data: ReaderData; ready: boolean; setData: React.Dispatch<React.SetStateAction<ReaderData>>;
  add: (bookId: string, type: ReaderAnnotation["type"], locator: ReaderLocator, text?: string, note?: string) => void;
  edit: (id: string, patch: Partial<Pick<ReaderAnnotation, "note" | "color" | "deletedAt">>) => void;
} | null>(null);

function readLocal() {
  for (const key of [KEY, KEY + "_backup"]) {
    try { const raw = localStorage.getItem(key); if (raw) return migrateReaderData(JSON.parse(raw)); } catch { /* Try backup. */ }
  }
  return emptyReaderData();
}
export function ReaderDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(readLocal);
  const [ready, setReady] = useState(!Capacitor.isNativePlatform());
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let cancelled = false;
    if (!Capacitor.isNativePlatform()) return;
    void (async () => {
      for (const key of [KEY, KEY + "_backup"]) {
        try { const { value } = await Preferences.get({ key }); if (value) { const parsed = migrateReaderData(JSON.parse(value)); if (!cancelled) setData(parsed); break; } } catch { /* Try backup. */ }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(data);
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: KEY });
        if (value && value !== serialized) await Preferences.set({ key: KEY + "_backup", value });
        await Preferences.set({ key: KEY, value: serialized });
      }
      const previous = localStorage.getItem(KEY);
      if (previous && previous !== serialized) localStorage.setItem(KEY + "_backup", previous);
      localStorage.setItem(KEY, serialized);
    }).catch(() => { toast.error("Não foi possível salvar anotações. Exporte uma cópia antes de fechar.", { id: "reader-save" }); });
  }, [data, ready]);
  const add = useCallback((bookId: string, type: ReaderAnnotation["type"], locator: ReaderLocator, text = "", note = "") => {
    if (!ready) return;
    const now = new Date().toISOString();
    setData(current => ({ ...current, annotations: [...current.annotations, { id: makeMobileId("annotation"), bookId, type, locator, text, note, color: "#facc15", createdAt: now, updatedAt: now }] }));
  }, [ready]);
  const edit = useCallback((id: string, patch: Partial<Pick<ReaderAnnotation, "note" | "color" | "deletedAt">>) => setData(current => ({ ...current, annotations: current.annotations.map(a => a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a) })), []);
  const contextValue = useMemo(() => ({ data, ready, setData, add, edit }), [add, data, edit, ready]);
  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}
export function useReaderData() { const value = useContext(Context); if (!value) throw new Error("ReaderDataProvider ausente"); return value; }
