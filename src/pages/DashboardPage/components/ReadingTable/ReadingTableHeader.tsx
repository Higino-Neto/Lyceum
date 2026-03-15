import { BookMarked, FileText, Clock, Calendar } from "lucide-react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function ReadingTableHeader() {
  return (
    <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider">
      <tr>
        <th className="text-left px-4 py-3">
          <div className="flex items-center gap-2">
            <BookMarked size={ICON_SIZE - 2} strokeWidth={STROKE_WIDTH} />
            <span>Obra</span>
          </div>
        </th>
        <th className="text-left px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText size={ICON_SIZE - 2} strokeWidth={STROKE_WIDTH} />
            <span>Págs</span>
          </div>
        </th>
        <th className="text-left px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock size={ICON_SIZE - 2} strokeWidth={STROKE_WIDTH} />
            <span>Tempo</span>
          </div>
        </th>
        <th className="text-left px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar size={ICON_SIZE - 2} strokeWidth={STROKE_WIDTH} />
            <span>Data</span>
          </div>
        </th>
      </tr>
    </thead>
  );
}
