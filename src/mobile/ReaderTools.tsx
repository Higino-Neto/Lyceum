/* eslint-disable react-refresh/only-export-components */
import { ReaderControls, defaultReaderControls, hasNativeReaderControls, type ReaderControlSettings } from "./readerControls";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import toast from "react-hot-toast";
import { useReaderData } from "./ReaderData";
import { appendHistory, exportAnnotations, type ReaderLocator } from "./readerModel";
import { useMobileConfirm } from "./MobileConfirmDialog";

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

export function ReaderTools({ bookId, locator, selection, clearSelection, navigate, getText, history, onTurn }: {
  bookId?: string; locator?: ReaderLocator; selection?: { locator: ReaderLocator; text: string }; clearSelection?: () => void;
  navigate?: (target: ReaderLocator) => void; getText?: () => Promise<string>;
  onTurn?: (direction: number) => void;
  history?: ReturnType<typeof useReaderHistory>;
}) {
  const { data, ready, add, edit, setData } = useReaderData();
  const confirm = useMobileConfirm();
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("Anotações");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState<{ voiceURI: string; name: string; lang: string }[]>([]);
  const chunks = useRef<string[]>([]);
  const speechIndex = useRef(0);
  const speechGeneration = useRef(0);
  useEffect(() => {
    if (native) { void ReaderControls.voices().then(r => setVoices(r.voices)).catch(() => undefined); return () => { speechGeneration.current++; void ReaderControls.stop(); }; }
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices()); update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      speechGeneration.current++;
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", update);
    };
  }, [bookId, native]);
  const speak = (index: number, generation: number) => {
    if (generation !== speechGeneration.current || !chunks.current[index]) { setPlaying(false); return; }
    speechIndex.current = index;
    if (bookId) setData(d => ({ ...d, listening: { ...d.listening, [bookId]: index } }));
    if (native) { setPlaying(true); void ReaderControls.speak({ text: chunks.current[index], voice, rate }).then(result => { if (!result.cancelled && generation === speechGeneration.current) speak(index + 1, generation); }).catch(() => { setPlaying(false); toast.error("Não foi possível iniciar a voz Android."); }); return; }
    const utterance = new SpeechSynthesisUtterance(chunks.current[index]);
    utterance.rate = rate; utterance.voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === voice) || null;
    utterance.onend = () => { if (generation === speechGeneration.current) speak(index + 1, generation); };
    utterance.onerror = () => { if (generation === speechGeneration.current) { setPlaying(false); toast.error("A voz não pôde ler este trecho."); } };
    setPlaying(true); window.speechSynthesis.speak(utterance);
  };
  const startSpeech = async () => {
    if (!getText) return;
    const generation = ++speechGeneration.current;
    try {
      const text = await getText();
      if (generation !== speechGeneration.current) return;
      chunks.current = text.match(/[^.!?\n]{1,350}(?:[.!?\n]+|$)/g) || [];
      if (!chunks.current.length) { toast("Este trecho não contém texto para leitura em voz alta."); return; }
      speak(Math.min(data.listening[bookId || ""] || 0, chunks.current.length - 1), generation);
    } catch { toast.error("Não foi possível obter texto para leitura."); }
  };
  const items = data.annotations.filter(a => !a.deletedAt && (!bookId || a.bookId === bookId)
    && (tab !== "Marcadores" || a.type === "bookmark") && `${a.text} ${a.note} ${a.bookId}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const cls = "rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-40";
  return <div onClick={e => e.stopPropagation()}>
    {bookId && !open && controls.tapZones && onTurn && <><button className="absolute bottom-[25%] left-0 z-20 h-[40%] w-[6%]" aria-label="Página anterior" onClick={() => onTurn(-1)} /><button className="absolute bottom-[25%] right-0 z-20 h-[40%] w-[6%]" aria-label="Próxima página" onClick={() => onTurn(1)} /></>}
    {bookId && native && !open && <div className="absolute bottom-[25%] left-0 z-30 h-[40%] w-3 touch-none" onTouchStart={e => { brightnessTouch.current = e.touches[0].clientY; }} onTouchMove={e => { const y = e.touches[0].clientY; const delta = (brightnessTouch.current - y) / 400; brightnessTouch.current = y; setControls(c => ({ ...c, brightness: Math.max(0.1, Math.min(1, (c.brightness < 0 ? 1 : c.brightness) + delta)) })); }} />}

    <button className="absolute bottom-36 right-3 z-30 rounded-full bg-emerald-700 px-4 py-3 text-sm text-white shadow-lg" onClick={() => setOpen(true)} aria-label={bookId ? "Anotações e histórico" : "Todas as notas"}>{bookId ? "Notas" : "Todas as notas"}</button>
    {selection && bookId && <div className="absolute inset-x-3 top-20 z-50 flex gap-2 rounded-xl bg-zinc-950 p-3 text-white shadow-xl">
      <button disabled={!ready} className={cls} onClick={() => { add(bookId, "highlight", selection.locator, selection.text); clearSelection?.(); }}>Destacar</button>
      <button disabled={!ready} className={cls} onClick={() => { add(bookId, "note", selection.locator, selection.text); clearSelection?.(); setOpen(true); }}>Anotar</button>
      <button className={cls} onClick={clearSelection}>Fechar</button>
    </div>}
    {open && <div className="fixed inset-0 z-[90] flex flex-col bg-zinc-950 p-4 pb-[max(24px,env(safe-area-inset-bottom))] text-zinc-100" role="dialog" aria-modal="true" aria-label="Caderno de leitura">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{bookId ? "Caderno de leitura" : "Todas as notas"}</h2><button className={cls} onClick={() => setOpen(false)}>Fechar</button></div>
      <div className="my-3 flex flex-wrap gap-2">{["Anotações", "Marcadores", "Histórico", "Ouvir"].map(t => <button className={cls} aria-pressed={tab === t} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Histórico" ? <div className="overflow-auto">
        <div className="flex gap-2"><button className={cls} disabled={!history || history.index === 0} onClick={() => history?.step(-1)}>Voltar</button><button className={cls} disabled={!history || history.index >= history.items.length - 1} onClick={() => history?.step(1)}>Avançar</button></div>
        {history?.items.map((l, i) => <button key={i} className={`${cls} mt-2 block w-full truncate text-left`} onClick={() => { navigate?.(l); setOpen(false); }}>{JSON.stringify(l)}</button>)}
        {!history && <p>O histórico fica disponível durante a leitura.</p>}
      </div> : tab === "Ouvir" ? <div className="space-y-3">
        {getText && (native || "speechSynthesis" in window) ? <>
          <label className="block">Velocidade <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} /> {rate}×</label>
          <select className={cls} value={voice} onChange={e => setVoice(e.target.value)} aria-label="Voz"><option value="">Voz padrão</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select>
          <div className="flex gap-2"><button className={cls} onClick={() => { if (native) { if (playing) { speechGeneration.current++; void ReaderControls.stop(); setPlaying(false); } else void startSpeech(); } else if (playing) { window.speechSynthesis.pause(); setPlaying(false); } else if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPlaying(true); } else void startSpeech(); }}>{playing ? "Pausar" : "Ouvir"}</button>
            <button className={cls} disabled={!chunks.current.length} onClick={() => { const generation = ++speechGeneration.current; if (native) void ReaderControls.stop().then(() => speak(speechIndex.current + 1, generation)); else { window.speechSynthesis.cancel(); speak(speechIndex.current + 1, generation); } }}>Próximo trecho</button>
            <button className={cls} onClick={() => { speechGeneration.current++; if (native) void ReaderControls.stop(); else window.speechSynthesis.cancel(); setPlaying(false); }}>Parar</button></div>
        </> : <p>Leitura em voz alta indisponível neste ambiente.</p>}
      </div> : <>
        <input className="mb-3 rounded-lg bg-zinc-900 p-3" placeholder="Buscar nas anotações" value={query} onChange={e => setQuery(e.target.value)} />
        {bookId && locator && <button disabled={!ready} className={cls} onClick={() => add(bookId, "bookmark", locator, selection?.text || "Posição de leitura")}>Marcar posição atual</button>}
        <div className="my-3 min-h-0 flex-1 space-y-3 overflow-auto">
          {!items.length && <p className="text-sm text-zinc-400">Nenhuma anotação encontrada. Selecione texto no livro para destacar ou anotar.</p>}
          {items.map(a => <article key={a.id} className="rounded-xl border border-zinc-800 p-3">
            <button className="w-full text-left text-sm" onClick={() => { if (navigate) { (history?.jump || navigate)(a.locator); setOpen(false); } }}><span style={{ color: a.color }}>{a.type === "bookmark" ? "Marcador" : "Anotação"}</span> · {a.text || "Sem trecho"}</button>
            <textarea className="mt-2 w-full rounded-lg bg-zinc-900 p-2 text-sm" aria-label="Nota" value={a.note} placeholder="Escreva uma nota" onChange={e => edit(a.id, { note: e.target.value })} />
            <div className="flex justify-between"><input aria-label="Cor do destaque" type="color" value={a.color} onChange={e => edit(a.id, { color: e.target.value })} /><button className="text-sm text-red-300" onClick={async () => { if (await confirm("Excluir esta anotação?")) edit(a.id, { deletedAt: new Date().toISOString() }); }}>Excluir</button></div>
          </article>)}
        </div>
        <div className="flex gap-2">{(["md", "csv"] as const).map(f => <button className={cls} key={f} onClick={() => { void downloadMobileText(`lyceum-notas-${Date.now()}.${f}`, exportAnnotations(items, f), f === "csv" ? "text/csv" : "text/markdown").catch(() => toast.error("Não foi possível exportar as notas.")); }}>Exportar {f.toUpperCase()}</button>)}</div>
      </>}
    </div>}
  </div>;
}
