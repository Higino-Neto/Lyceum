import {
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  GripVertical,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  BookWithThumbnail,
  ReadingMapItem,
  ReadingMapPayload,
  ReadingMapSectionWithItems,
  ReadingStatus,
} from "../../../types/LibraryTypes";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";
import {
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../../Library/utils";
import {
  getMapStats,
} from "../atlasUtils";
import {
  STATUS_VISUAL,
  statusLabel,
  type DropTarget,
  type StatusFilter,
} from "../atlasTypes";
import { LocalCover } from "./BookCover";

type RoadmapStats = ReturnType<typeof getMapStats>;

interface RoadmapBoardProps {
  payload?: ReadingMapPayload;
  sections: ReadingMapSectionWithItems[];
  activeSection: ReadingMapSectionWithItems | null;
  stats: RoadmapStats;
  isLoading: boolean;
  hasError: boolean;
  zoom: number;
  statusFilter: StatusFilter;
  canDrag: boolean;
  draggedItemId: string | null;
  dropTarget: DropTarget;
  onMapChange: (mapId: string) => void;
  onNewMap: () => void;
  onNewSection: () => void;
  onAddLibraryBook: () => void;
  onAddManualBook: () => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onZoomChange: (zoom: number) => void;
  onActiveSectionChange: (sectionId: string) => void;
  onOpenBook: (book: BookWithThumbnail) => void;
  onSectionSave: (sectionId: string, updates: { title: string; description: string }) => void;
  onItemStatusChange: (itemId: string, status: ReadingStatus) => void;
  onItemDelete: (itemId: string) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOverItem: (event: ReactDragEvent<HTMLElement>, item: ReadingMapItem, index: number) => void;
  onDragOverSection: (event: ReactDragEvent<HTMLElement>, sectionId: string, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function RoadmapCover({ item }: { item: ReadingMapItem }) {
  if (item.book) return <LocalCover book={item.book} />;

  return (
    <div className="flex aspect-[2/3] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      <FileText size={26} className={item.missingDocument ? "text-amber-400" : "text-zinc-600"} />
    </div>
  );
}

function RoadmapStatusControl({
  value,
  label,
  onChange,
}: {
  value: ReadingStatus;
  label: string;
  onChange: (status: ReadingStatus) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950"
      aria-label={`Status de ${label}`}
    >
      {READING_STATUS_OPTIONS.map((option) => {
        const meta = STATUS_VISUAL[option.value];
        const selected = value === option.value;
        const Icon = option.value === "read" ? CheckCircle2 : Circle;

        return (
          <button
            key={option.value}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(option.value);
            }}
            className={`flex h-7 cursor-pointer items-center justify-center border-r border-zinc-800 last:border-r-0 ${
              selected
                ? `${meta.bg} ${meta.text}`
                : "text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
            title={meta.label}
            aria-label={`${meta.label} - ${label}`}
          >
            <Icon size={12} fill={selected ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

interface RoadmapItemCardProps {
  item: ReadingMapItem;
  index: number;
  canDrag: boolean;
  isDragging: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onDelete: (itemId: string) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, item: ReadingMapItem, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function RoadmapItemCard({
  item,
  index,
  canDrag,
  isDragging,
  showDropBefore,
  showDropAfter,
  onOpen,
  onStatusChange,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: RoadmapItemCardProps) {
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const meta = STATUS_VISUAL[item.status];

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, item, index)}
      onDrop={onDrop}
      className={`group relative z-10 w-[154px] flex-shrink-0 rounded-sm border bg-zinc-900 p-2 transition ${
        isDragging
          ? "scale-[0.98] border-green-500/60 opacity-45"
          : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
    >
      {showDropBefore && (
        <div className="absolute -left-2 top-2 bottom-2 w-1 rounded-sm bg-green-400 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]" />
      )}
      {showDropAfter && (
        <div className="absolute -right-2 top-2 bottom-2 w-1 rounded-sm bg-green-400 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]" />
      )}
      <div className="absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical size={13} />
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(item.id);
        }}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
        title="Remover do mapa"
      >
        <Trash2 size={12} />
      </button>
      <div className="relative">
        <RoadmapCover item={item} />
        <div className={`absolute bottom-2 left-2 flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${meta.border} ${meta.bg} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </div>
      </div>
      <div className="flex h-[94px] flex-col pt-3">
        <h3 className="line-clamp-2 text-xs font-medium leading-4 text-zinc-200">
          {title}
        </h3>
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          {item.author || item.book?.author || (item.book ? getBookFolderLabel(item.book.filePath) : "Livro manual")}
        </p>
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>{item.book ? formatPageCount(item.book.numPages, item.book.fileType) : "planejado"}</span>
            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {item.book ? getFileTypeLabel(item.book.fileType, item.book.filePath) : "Manual"}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-1">
            <RoadmapStatusControl
              value={item.status}
              label={item.title}
              onChange={(status) => onStatusChange(item.id, status)}
            />
            {item.book && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(item.book!);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-100"
                title="Abrir livro"
              >
                <BookOpen size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
      {item.missingDocument && (
        <div className="mt-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          arquivo ausente
        </div>
      )}
    </article>
  );
}

interface SectionDetailsProps {
  section: ReadingMapSectionWithItems | null;
  onSave: (sectionId: string, updates: { title: string; description: string }) => void;
}

function SectionDetails({ section, onSave }: SectionDetailsProps) {
  const [title, setTitle] = useState(section?.title || "");
  const [description, setDescription] = useState(section?.description || "");

  useEffect(() => {
    setTitle(section?.title || "");
    setDescription(section?.description || "");
  }, [section?.id, section?.title, section?.description]);

  if (!section) {
    return (
      <aside className="rounded-sm border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
        Selecione uma etapa para ver os detalhes.
      </aside>
    );
  }

  const stats = getMapStats([section]);

  return (
    <aside className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-green-400">
          Descricao da etapa
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-3 h-9 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm font-medium text-zinc-100 outline-none focus:border-green-500"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={8}
          className="w-full resize-none rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-green-500"
        />
        <button
          type="button"
          onClick={() => onSave(section.id, { title, description })}
          className="h-9 cursor-pointer rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400"
        >
          Salvar etapa
        </button>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Livros</p>
            <p className="mt-1 text-base font-semibold text-zinc-100">{stats.total}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Concluidos</p>
            <p className="mt-1 text-base font-semibold text-green-300">{stats.read}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Em curso</p>
            <p className="mt-1 text-base font-semibold text-sky-300">{stats.reading}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Fila</p>
            <p className="mt-1 text-base font-semibold text-zinc-300">{stats.want}</p>
          </div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
          Paginas estimadas: <span className="text-zinc-300">{stats.pages || "sem dados"}</span>
        </div>
      </div>
    </aside>
  );
}

export default function RoadmapBoard({
  payload,
  sections,
  activeSection,
  stats,
  isLoading,
  hasError,
  zoom,
  statusFilter,
  canDrag,
  draggedItemId,
  dropTarget,
  onMapChange,
  onNewMap,
  onNewSection,
  onAddLibraryBook,
  onAddManualBook,
  onStatusFilterChange,
  onZoomChange,
  onActiveSectionChange,
  onOpenBook,
  onSectionSave,
  onItemStatusChange,
  onItemDelete,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDragOverSection,
  onDrop,
}: RoadmapBoardProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Mapa de leitura"
            value={payload?.activeMap.id || ""}
            onChange={(event) => onMapChange(event.target.value)}
            className="h-9 cursor-pointer rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
          >
            {(payload?.maps ?? []).map((map) => (
              <option key={map.id} value={map.id}>{map.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onNewMap}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <Plus size={15} />
            Novo mapa
          </button>
          <button
            type="button"
            onClick={onNewSection}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <Plus size={15} />
            Nova etapa
          </button>
          <button
            type="button"
            onClick={onAddLibraryBook}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400"
          >
            <Plus size={15} />
            Adicionar livro
          </button>
          <button
            type="button"
            onClick={onAddManualBook}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <FileText size={15} />
            Livro manual
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
            {(["all", "read", "reading", "paused", "want_to_read"] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onStatusFilterChange(filter)}
                className={`flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs ${statusFilter === filter ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
              >
                {filter !== "all" && (
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VISUAL[filter].dot}`} />
                )}
                {filter === "all" ? "Todos" : statusLabel(filter)}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.8, Number((zoom - 0.1).toFixed(1))))}
              className="flex h-8 w-10 cursor-pointer items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Reduzir zoom"
            >
              <Minus size={14} />
            </button>
            <span className="flex h-8 w-16 items-center justify-center border-x border-zinc-800 text-xs text-zinc-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(1.3, Number((zoom + 0.1).toFixed(1))))}
              className="flex h-8 w-10 cursor-pointer items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Aumentar zoom"
            >
              <Plus size={14} />
            </button>
          </div>
          {!canDrag && (
            <span className="text-xs text-zinc-500">
              Use Todos para reorganizar.
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
        {[
          ["Etapas", stats.sections],
          ["Livros", stats.total],
          ["Concluidos", stats.read],
          ["Em curso", stats.reading],
          ["Fila", stats.want],
          ["Paginas", stats.pages || "-"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2">
            <p className="text-zinc-500">{label}</p>
            <p className="mt-1 text-base font-semibold text-zinc-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-auto rounded-sm border border-zinc-800 bg-zinc-900/50 p-3">
          {isLoading ? (
            <div className="flex h-80 items-center justify-center text-sm text-zinc-500">Carregando mapa...</div>
          ) : hasError ? (
            <div className="flex h-80 items-center justify-center text-sm text-red-300">Erro ao carregar mapa.</div>
          ) : (
            <div
              className="min-w-[820px] space-y-3"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: `${100 / zoom}%`,
              }}
            >
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  onMouseEnter={() => onActiveSectionChange(section.id)}
                  onClick={() => onActiveSectionChange(section.id)}
                  onDragOver={(event) => onDragOverSection(event, section.id, section.items.length)}
                  onDrop={onDrop}
                  className={`grid min-h-[236px] grid-cols-[150px_minmax(0,1fr)] overflow-hidden rounded-sm border transition-colors ${
                    activeSection?.id === section.id
                      ? "border-green-500/50 bg-green-500/[0.025]"
                      : "border-zinc-800 bg-zinc-950/70"
                  }`}
                >
                  <button
                    type="button"
                    className="flex h-full cursor-pointer flex-col items-start justify-center border-r border-zinc-800 bg-zinc-950/60 px-5 text-left"
                    onClick={() => onActiveSectionChange(section.id)}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-green-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-3 text-base font-semibold text-zinc-100">
                      {section.title}
                    </span>
                    <span className="mt-3 text-xs text-zinc-500">
                      {section.items.length} livros
                    </span>
                  </button>
                  <div className="relative min-h-[236px] overflow-x-auto px-8 py-5">
                    {index > 0 && (
                      <div className="absolute left-1/2 top-0 h-5 w-px bg-zinc-700" aria-hidden="true" />
                    )}
                    {index < sections.length - 1 && (
                      <div className="absolute bottom-0 left-1/2 h-5 w-px bg-zinc-700" aria-hidden="true" />
                    )}
                    <div className="relative flex min-h-[194px] items-start justify-center gap-4">
                      {section.items.length > 1 && (
                        <div className="absolute left-10 right-10 top-[74px] h-px bg-zinc-800" aria-hidden="true" />
                      )}
                      {section.items.length === 0 ? (
                        <div
                          onDragOver={(event) => onDragOverSection(event, section.id, 0)}
                          onDrop={onDrop}
                          className={`relative z-10 flex min-h-[178px] min-w-[260px] items-center justify-center rounded-sm border border-dashed px-4 py-3 text-center text-sm transition-colors ${
                            dropTarget?.sectionId === section.id
                              ? "border-green-500/60 bg-green-500/10 text-green-200"
                              : "border-zinc-800 text-zinc-500"
                          }`}
                        >
                          Solte um livro nesta etapa.
                        </div>
                      ) : (
                        section.items.map((item, itemIndex) => {
                          const showDropBefore =
                            dropTarget?.sectionId === section.id &&
                            dropTarget.index === itemIndex &&
                            draggedItemId !== item.id;
                          const showDropAfter =
                            dropTarget?.sectionId === section.id &&
                            dropTarget.index === itemIndex + 1 &&
                            draggedItemId !== item.id;

                          return (
                            <RoadmapItemCard
                              key={item.id}
                              item={item}
                              index={itemIndex}
                              canDrag={canDrag}
                              isDragging={draggedItemId === item.id}
                              showDropBefore={Boolean(showDropBefore)}
                              showDropAfter={Boolean(showDropAfter)}
                              onOpen={onOpenBook}
                              onDragStart={onDragStart}
                              onDragEnd={onDragEnd}
                              onDragOver={onDragOverItem}
                              onDrop={onDrop}
                              onStatusChange={onItemStatusChange}
                              onDelete={onItemDelete}
                            />
                          );
                        })
                      )}
                      {section.items.length > 0 && dropTarget?.sectionId === section.id && dropTarget.index >= section.items.length && (
                        <div className="relative z-20 h-[178px] w-1 flex-shrink-0 rounded-sm bg-green-400" />
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <SectionDetails
          section={activeSection}
          onSave={onSectionSave}
        />
      </div>
    </>
  );
}
