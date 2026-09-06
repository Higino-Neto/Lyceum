import { useRef, useState } from "react";
import toast from "react-hot-toast";
import type { MobileLibraryState } from "./types";
import { useReaderData } from "./ReaderData";
import { downloadMobileText } from "./ReaderTools";
import { createMobileBackup, hashMobileFile, parseMobileBackup, type MobileBackup } from "./mobileBackup";
import { mergeAnnotations } from "./readerModel";
import { resolveMobileBookDataUrl } from "./bookFileStorage";

export default function MobileBackupPanel({ state, setState }: { state: MobileLibraryState; setState: React.Dispatch<React.SetStateAction<MobileLibraryState>> }) {
  const { data, setData, ready } = useReaderData();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<MobileBackup>();
  const [report, setReport] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const conflicting = preview?.reader.annotations.filter(a => data.annotations.some(local => local.id === a.id && JSON.stringify(local) !== JSON.stringify(a))).length || 0;
  const restore = (preferIncoming: boolean) => {
    if (!preview) return;
    setState(current => {
      const books = new Map(current.books.map(b => [b.id, b]));
      for (const incoming of preview.library.books) {
        const local = books.get(incoming.id);
        if (!local || preferIncoming) books.set(incoming.id, { ...incoming, storagePath: local?.storagePath, dataUrl: local?.dataUrl, thumbnailPath: local?.thumbnailPath });
      }
      const merge = <T extends { id: string }>(local: T[], remote: T[]) => [...new Map([...remote, ...local].map(item => [item.id, item])).values()];
      return { ...current, books: [...books.values()], folders: merge(current.folders, preview.library.folders), sourceFolders: merge(current.sourceFolders, preview.library.sourceFolders), categories: [...new Set([...current.categories, ...preview.library.categories])], collections: merge(current.collections || [], preview.library.collections || []) };
    });
    setData(current => {
      const merged = mergeAnnotations(current.annotations, preview.reader.annotations);
      const annotations = preferIncoming ? [...new Map([...current.annotations, ...preview.reader.annotations].map(a => [a.id, a])).values()] : current.annotations.concat(preview.reader.annotations.filter(a => !current.annotations.some(local => local.id === a.id)));
      return { ...current, annotations: conflicting ? annotations : merged.annotations };
    });
    setPreview(undefined); toast.success("Backup mesclado. Religue os arquivos de livros ausentes pela biblioteca.");
  };
  return <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <h2 className="font-semibold">Backup e integração</h2>
    <p className="text-sm text-zinc-400">Metadados, progresso, coleções e anotações. Os arquivos dos livros são exportados separadamente.</p>
    <div className="flex flex-wrap gap-2">
      <button className="rounded bg-zinc-800 p-3 text-sm" disabled={!ready} onClick={() => { void downloadMobileText(`lyceum-backup-${Date.now()}.json`, JSON.stringify(createMobileBackup(state, data), null, 2), "application/json").catch(() => toast.error("Não foi possível exportar o backup.")); }}>Exportar backup</button>
      <button className="rounded bg-zinc-800 p-3 text-sm" disabled={!ready} onClick={() => input.current?.click()}>Restaurar backup</button>
      <button className="rounded bg-zinc-800 p-3 text-sm" disabled={busy} onClick={async () => {
        setBusy(true); const messages: string[] = [];
        for (const book of state.books) {
          try {
            const url = await resolveMobileBookDataUrl(book); if (!url) { messages.push(`${book.title}: arquivo ausente`); continue; }
            const blob = await (await fetch(url)).blob();
            const sizeOK = !book.fileSize || blob.size === book.fileSize;
            const hashOK = !book.contentHash || await hashMobileFile(blob) === book.contentHash;
            messages.push(`${book.title}: ${sizeOK && hashOK ? book.contentHash ? "SHA-256 e tamanho conferidos" : "tamanho conferido; sem hash original" : "integridade divergente"}`);
          } catch { messages.push(`${book.title}: não foi possível verificar`); }
        }
        setReport(messages); setBusy(false);
      }}>{busy ? "Verificando…" : "Verificar arquivos"}</button>
    </div>
    <input hidden ref={input} type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 50 * 1024 * 1024) throw new Error("Backup maior que 50 MB."); setPreview(parseMobileBackup(await file.text())); } catch (error) { toast.error(error instanceof Error ? error.message : "Backup inválido"); } }} />
    {preview && <div className="space-y-3 rounded-lg border border-amber-700 p-3" role="dialog" aria-label="Revisar restauração">
      <p>{preview.library.books.length} livros · {preview.reader.annotations.length} anotações · {conflicting} anotações divergentes. Revise a preferência para itens que já existem.</p>
      <button className="mr-2 rounded bg-zinc-800 p-3" onClick={() => restore(false)}>Manter meus itens existentes</button>
      <button className="mr-2 rounded bg-amber-800 p-3" onClick={() => restore(true)}>Usar os itens do backup</button>
      <button className="rounded bg-zinc-800 p-3" onClick={() => setPreview(undefined)}>Cancelar</button>
    </div>}
    {report.length > 0 && <ul className="max-h-64 overflow-auto text-xs text-zinc-300">{report.map((message, i) => <li key={i} className="py-1">{message}</li>)}</ul>}
  </section>;
}
