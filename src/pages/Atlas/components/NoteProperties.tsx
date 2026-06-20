import { type ReadingStatusItem, type ReadingStatus } from "../../../types/LibraryTypes";
import { READING_STATUS_OPTIONS, READING_STATUS_LABELS } from "../../../lib/readingStatus";

interface NotePropertiesProps {
  item: ReadingStatusItem;
  draft: NotePropertiesDraft;
  onChange: (draft: NotePropertiesDraft) => void;
}

export interface NotePropertiesDraft {
  title: string;
  author: string;
  status: ReadingStatus;
  isbn: string;
  publisher: string;
  publishDate: string;
  subject: string;
}

export function emptyNotePropertiesDraft(item: ReadingStatusItem | null | undefined): NotePropertiesDraft {
  return {
    title: item?.title || "",
    author: item?.author || "",
    status: item?.status || "want_to_read",
    isbn: item?.isbn || "",
    publisher: item?.publisher || "",
    publishDate: item?.publishDate || "",
    subject: item?.subject || "",
  };
}

export function notePropertiesDraftChanged(a: NotePropertiesDraft, b: NotePropertiesDraft): boolean {
  return (
    a.title !== b.title ||
    a.author !== b.author ||
    a.status !== b.status ||
    a.isbn !== b.isbn ||
    a.publisher !== b.publisher ||
    a.publishDate !== b.publishDate ||
    a.subject !== b.subject
  );
}

export function notePropertiesDraftToItemId(itemId: string, draft: NotePropertiesDraft): {
  title?: string;
  author?: string | null;
  status?: ReadingStatus;
  isbn?: string | null;
  publisher?: string | null;
  publishDate?: string | null;
  subject?: string | null;
} {
  const result: Record<string, unknown> = {};
  if (draft.title) result.title = draft.title;
  result.author = draft.author || null;
  result.status = draft.status;
  result.isbn = draft.isbn || null;
  result.publisher = draft.publisher || null;
  result.publishDate = draft.publishDate || null;
  result.subject = draft.subject || null;
  return result;
}

const fieldClass =
  "w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-green-500";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-zinc-500";

export function NoteProperties({ item, draft, onChange }: NotePropertiesProps) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-900/30 p-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelClass}>Titulo</label>
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            className={fieldClass}
            placeholder="Titulo do livro"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelClass}>Autor</label>
          <input
            value={draft.author}
            onChange={(e) => onChange({ ...draft, author: e.target.value })}
            className={fieldClass}
            placeholder="Autor"
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value as ReadingStatus })}
            className={fieldClass}
          >
            {READING_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {READING_STATUS_LABELS[opt.value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>ISBN</label>
          <input
            value={draft.isbn}
            onChange={(e) => onChange({ ...draft, isbn: e.target.value })}
            className={fieldClass}
            placeholder="ISBN"
          />
        </div>
        <div>
          <label className={labelClass}>Editora</label>
          <input
            value={draft.publisher}
            onChange={(e) => onChange({ ...draft, publisher: e.target.value })}
            className={fieldClass}
            placeholder="Editora"
          />
        </div>
        <div>
          <label className={labelClass}>Data de publicacao</label>
          <input
            value={draft.publishDate}
            onChange={(e) => onChange({ ...draft, publishDate: e.target.value })}
            className={fieldClass}
            placeholder="Data"
          />
        </div>
      </div>
    </div>
  );
}
