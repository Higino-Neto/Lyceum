import type { ReactNode } from "react";
import type { ReadingStatus } from "../../../types/LibraryTypes";
import { READING_STATUS_LABELS } from "../../../lib/readingStatus";

interface AtlasColumnProps {
  status: ReadingStatus;
  count: number;
  description: string;
  children: ReactNode;
}

const COLUMN_ACCENTS: Record<ReadingStatus, string> = {
  want_to_read: "border-zinc-800",
  reading: "border-sky-500/35",
  read: "border-green-500/35",
};

export default function AtlasColumn({
  status,
  count,
  description,
  children,
}: AtlasColumnProps) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-sm border bg-zinc-900/60 ${COLUMN_ACCENTS[status]}`}
    >
      <header className="flex min-h-[72px] items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            {READING_STATUS_LABELS[status]}
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {description}
          </p>
        </div>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-950 px-2 text-xs font-medium text-zinc-300">
          {count}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {children}
      </div>
    </section>
  );
}
