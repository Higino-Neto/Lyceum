import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked,
  RefreshCw,
} from "lucide-react";
import {
  emptyNotePropertiesDraft,
  notePropertiesDraftChanged,
  notePropertiesDraftToItemId,
  type NotePropertiesDraft,
} from "./components/NoteProperties";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useGetReadings from "../../hooks/useGetReadings";
import type {
  BookWithThumbnail,
  ReadingMapItem,
  ReadingMapPayload,
  ReadingStatus,
  ReadingStatusItem,
  ReadingStatusPayload,
} from "../../types/LibraryTypes";
import type TableReading from "../../types/TableReading";
import BookMetadataSearchDialog, {
  type BookMetadataSavePayload,
} from "../Library/components/BookMetadataSearchDialog";
import SetThumbnailDialog from "../../components/SetThumbnailDialog";
import StatusBoardView from "./components/StatusBoard";
import RoadmapBoard from "./components/RoadmapBoard";
import {
  LibraryPickerDialog,
  ManualBookDialog,
  SimpleTextDialog,
} from "./components/AtlasDialogs";
import {
  ATLAS_BOOKS_QUERY_KEY,
  ATLAS_MAP_QUERY_KEY,
  ATLAS_STATUS_QUERY_KEY,
  statusLabel,
  type AddTarget,
  type AtlasView,
  type DropTarget,
  type StatusDropTarget,
  type StatusFilter,
} from "./atlasTypes";
import {
  buildFrontmatter,
  createSyntheticBook,
  fetchAtlasBooks,
  fetchReadingMap,
  fetchReadingStatusItems,
  getMapStats,
  getManualCoverSrc,
  getNavigationId,
} from "./atlasUtils";




export default function AtlasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AtlasView>("roadmap");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeStatusView, setActiveStatusView] = useState<ReadingStatus>("reading");
  const [statusSearch, setStatusSearch] = useState("");
  const [selectedStatusItemId, setSelectedStatusItemId] = useState<string | null>(null);
  const [coverTarget, setCoverTarget] = useState<ReadingStatusItem | null>(null);
  const [thumbnailDialog, setThumbnailDialog] = useState<{ open: boolean; imagePath: string }>({ open: false, imagePath: "" });
  const [metadataTarget, setMetadataTarget] = useState<ReadingStatusItem | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [draggedStatusItemId, setDraggedStatusItemId] = useState<string | null>(null);
  const [statusDropTarget, setStatusDropTarget] = useState<StatusDropTarget>(null);
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<AddTarget | null>(null);
  const [manualDialogTarget, setManualDialogTarget] = useState<AddTarget | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const apiAvailable = Boolean(window.api?.listBooks);
  const roadmapApiAvailable = Boolean(window.api?.getReadingMap);
  const statusApiAvailable = Boolean(window.api?.getReadingStatusItems);

  const booksQuery = useQuery({
    queryKey: ATLAS_BOOKS_QUERY_KEY,
    queryFn: fetchAtlasBooks,
    enabled: apiAvailable,
    staleTime: 20_000,
  });

  const mapQuery = useQuery({
    queryKey: [ATLAS_MAP_QUERY_KEY, selectedMapId],
    queryFn: () => fetchReadingMap(selectedMapId),
    enabled: apiAvailable && roadmapApiAvailable,
    staleTime: 20_000,
  });

  const readingsQuery = useGetReadings();

  const statusQuery = useQuery({
    queryKey: ATLAS_STATUS_QUERY_KEY,
    queryFn: fetchReadingStatusItems,
    enabled: apiAvailable && statusApiAvailable,
    staleTime: 20_000,
  });

  const noteQuery = useQuery({
    queryKey: ["atlas-status-note", selectedStatusItemId],
    queryFn: async () => {
      if (!selectedStatusItemId) {
        return { itemId: "", content: "", notePath: null, vaultPath: statusQuery.data?.vaultPath || null };
      }
      const result = await window.api.getReadingStatusItemNote(selectedStatusItemId);
      if (!result.success || !result.payload) {
        throw new Error(result.error || "Erro ao carregar nota");
      }
      return result.payload;
    },
    enabled: apiAvailable && statusApiAvailable && Boolean(selectedStatusItemId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!window.api?.onLibraryUpdated) return undefined;
    return window.api.onLibraryUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    });
  }, [queryClient]);

  useEffect(() => {
    const payload = mapQuery.data;
    if (!payload) return;
    if (selectedMapId && selectedMapId !== payload.activeMap.id) {
      setSelectedMapId(payload.activeMap.id);
    }
    if (!activeSectionId || !payload.sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(payload.sections[0]?.id || null);
    }
  }, [activeSectionId, mapQuery.data, selectedMapId]);

  useEffect(() => {
    const activeItems = (statusQuery.data?.items ?? []).filter((item) => item.status === activeStatusView);
    if (selectedStatusItemId && activeItems.some((item) => item.id === selectedStatusItemId)) return;
    setSelectedStatusItemId(activeItems.find((item) => item.isPrimary)?.id || activeItems[0]?.id || null);
  }, [activeStatusView, selectedStatusItemId, statusQuery.data?.items]);

  const payload = mapQuery.data;
  const statusItems = statusQuery.data?.items ?? [];
  const atlasVaultPath = statusQuery.data?.vaultPath ?? noteQuery.data?.vaultPath ?? null;
  const cachedReadings = queryClient.getQueryData<TableReading[]>(["readings"]) ?? [];
  const readings = readingsQuery.data ?? cachedReadings;
  const stats = useMemo(() => getMapStats(payload?.sections ?? []), [payload?.sections]);
  const activeSection = useMemo(
    () => payload?.sections.find((section) => section.id === activeSectionId) || payload?.sections[0] || null,
    [activeSectionId, payload?.sections],
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
  }, [queryClient]);

  const applyMapResult = useCallback((result: { success: boolean; payload?: ReadingMapPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      toast.error(result.error || "Erro ao atualizar mapa");
      return;
    }

    setSelectedMapId(result.payload.activeMap.id);
    queryClient.setQueryData([ATLAS_MAP_QUERY_KEY, result.payload.activeMap.id], result.payload);
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
  }, [queryClient]);

  const applyStatusResult = useCallback((result: { success: boolean; payload?: ReadingStatusPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      toast.error(result.error || "Erro ao atualizar estados");
      return;
    }

    queryClient.setQueryData(ATLAS_STATUS_QUERY_KEY, result.payload);
    queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
  }, [queryClient]);

  const handleOpenBook = useCallback(async (book: BookWithThumbnail) => {
    if (!book.filePath) {
      toast.error("Caminho do arquivo nao encontrado");
      return;
    }

    try {
      const result = await window.api.openDocumentByHash(book.fileHash, book.filePath);
      if (!result) {
        toast.error("Erro ao abrir o arquivo");
        return;
      }
      if ("error" in result) {
        toast.error(result.message || "Erro ao abrir o arquivo");
        return;
      }

      const filePath = result.foundAt || result.filePath || book.filePath;
      const fileType =
        result.fileType === "epub" || filePath.toLowerCase().endsWith(".epub")
          ? "epub"
          : "pdf";

      navigate("/reading", {
        state: {
          fileBuffer: result.fileBuffer,
          fileHash: result.fileHash || book.fileHash,
          fileName: result.fileName || book.fileName || book.title,
          filePath,
          fileType,
          source: "library",
          navigationId: getNavigationId(),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir o arquivo");
    }
  }, [navigate]);

  const handleMapMutation = useCallback(async (
    mutation: () => Promise<{ success: boolean; payload?: ReadingMapPayload; error?: string }>,
    successMessage?: string,
  ) => {
    try {
      const result = await mutation();
      applyMapResult(result);
      if (result.success && successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar mapa");
    }
  }, [applyMapResult]);

  const handleStatusMutation = useCallback(async (
    mutation: () => Promise<{ success: boolean; payload?: ReadingStatusPayload; error?: string }>,
    successMessage?: string,
  ) => {
    try {
      const result = await mutation();
      applyStatusResult(result);
      if (result.success && successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar estados");
    }
  }, [applyStatusResult]);

  const handleChooseVault = useCallback(async () => {
    try {
      const result = await window.api.selectFolder();
      const folderPath = result && !result.canceled ? result.filePaths[0] : null;
      if (!folderPath) return;
      await handleStatusMutation(
        () => window.api.setAtlasNotesVault(folderPath),
        "Vault definido",
      );
      queryClient.invalidateQueries({ queryKey: ["atlas-status-note", selectedStatusItemId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao definir Vault");
    }
  }, [handleStatusMutation, queryClient, selectedStatusItemId]);

  const handleSaveNote = useCallback(async (markdown: string, properties: NotePropertiesDraft) => {
    if (!selectedStatusItemId) {
      toast.error("Selecione um livro");
      return;
    }

    setNoteSaving(true);
    try {
      const currentItem = statusItems.find((i) => i.id === selectedStatusItemId);
      if (currentItem && notePropertiesDraftChanged(emptyNotePropertiesDraft(currentItem), properties)) {
        const metaResult = await window.api.updateReadingStatusItemMetadata(
          selectedStatusItemId,
          notePropertiesDraftToItemId(selectedStatusItemId, properties),
        );
        if (!metaResult.success) {
          throw new Error(metaResult.error || "Erro ao salvar metadados");
        }
      }

      const fullContent = buildFrontmatter(properties) + markdown;
      const result = await window.api.saveReadingStatusItemNote(selectedStatusItemId, fullContent);
      if (!result.success || !result.payload) {
        throw new Error(result.error || "Erro ao salvar nota");
      }
      queryClient.setQueryData(["atlas-status-note", selectedStatusItemId], result.payload);
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
      toast.success("Nota salva");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar nota");
    } finally {
      setNoteSaving(false);
    }
  }, [queryClient, selectedStatusItemId, statusItems]);

  const handleCoverChange = useCallback(async (item: ReadingStatusItem) => {
    try {
      const imagePath = await window.api.openImageDialog();
      if (!imagePath) return;
      setCoverTarget(item);
      setThumbnailDialog({ open: true, imagePath });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao selecionar capa");
    }
  }, []);

  const handleSetStatusCover = useCallback(async (mode: "replace" | "prepend") => {
    const target = coverTarget;
    if (!target || !thumbnailDialog.imagePath) return;

    try {
      if (target.bookId && target.book) {
        const result = await window.api.setThumbnail(target.book.fileHash, thumbnailDialog.imagePath, mode);
        if (!result.success) throw new Error(result.error || "Erro ao definir capa");
        toast.success("Capa atualizada");
        queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
      } else {
        const result = await window.api.updateReadingStatusItemCover(target.id, thumbnailDialog.imagePath);
        applyStatusResult(result);
        if (!result.success) return;
        toast.success("Capa atualizada");
      }
      setThumbnailDialog({ open: false, imagePath: "" });
      setCoverTarget(null);
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao definir capa");
    }
  }, [applyStatusResult, coverTarget, queryClient, thumbnailDialog.imagePath]);

  const handleManualMetadataSave = useCallback(async (
    item: ReadingStatusItem,
    metadata: BookMetadataSavePayload,
  ) => {
    await handleStatusMutation(
      () => window.api.updateReadingStatusItemMetadata(item.id, {
        title: metadata.title,
        author: metadata.author ?? null,
        description: metadata.description ?? null,
        isbn: metadata.isbn ?? null,
        publisher: metadata.publisher ?? null,
        publishDate: metadata.publishDate ?? null,
        subject: metadata.subject ?? null,
        manualTotalPages: metadata.pageCount ?? null,
        coverPath: metadata.coverUrl ?? undefined,
      }),
      "Metadados salvos",
    );
  }, [handleStatusMutation]);

  const handleRoadmapDragStart = useCallback((
    event: ReactDragEvent<HTMLElement>,
    itemId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-lyceum-roadmap-item", itemId);
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedItemId(itemId);
  }, []);

  const handleRoadmapDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDropTarget(null);
  }, []);

  const handleRoadmapDragOverSection = useCallback((
    event: ReactDragEvent<HTMLElement>,
    sectionId: string,
    index: number,
  ) => {
    if (!draggedItemId || statusFilter !== "all") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveSectionId(sectionId);
    setDropTarget({ sectionId, index });
  }, [draggedItemId, statusFilter]);

  const handleRoadmapDragOverItem = useCallback((
    event: ReactDragEvent<HTMLElement>,
    item: ReadingMapItem,
    index: number,
  ) => {
    if (!draggedItemId || draggedItemId === item.id || statusFilter !== "all") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientX > bounds.left + bounds.width / 2;
    setActiveSectionId(item.sectionId);
    setDropTarget({
      sectionId: item.sectionId,
      index: index + (insertAfter ? 1 : 0),
    });
  }, [draggedItemId, statusFilter]);

  const handleRoadmapDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const itemId =
      event.dataTransfer.getData("application/x-lyceum-roadmap-item") ||
      event.dataTransfer.getData("text/plain") ||
      draggedItemId;
    const target = dropTarget;

    setDraggedItemId(null);
    setDropTarget(null);

    if (!itemId || !target || statusFilter !== "all") return;

    void handleMapMutation(
      () => window.api.positionReadingMapItem(itemId, target.sectionId, target.index),
      "Livro reposicionado",
    );
  }, [draggedItemId, dropTarget, handleMapMutation, statusFilter]);

  const handleStatusDragStart = useCallback((
    event: ReactDragEvent<HTMLElement>,
    itemId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-lyceum-status-item", itemId);
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedStatusItemId(itemId);
  }, []);

  const handleStatusDragEnd = useCallback(() => {
    setDraggedStatusItemId(null);
    setStatusDropTarget(null);
  }, []);

  const handleStatusDragOverBoard = useCallback((
    event: ReactDragEvent<HTMLElement>,
    index: number,
  ) => {
    if (!draggedStatusItemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setStatusDropTarget({ status: activeStatusView, index });
  }, [activeStatusView, draggedStatusItemId]);

  const handleStatusDragOverItem = useCallback((
    event: ReactDragEvent<HTMLElement>,
    item: ReadingStatusItem,
    index: number,
  ) => {
    if (!draggedStatusItemId || draggedStatusItemId === item.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY > bounds.top + bounds.height / 2;
    setStatusDropTarget({
      status: activeStatusView,
      index: index + (insertAfter ? 1 : 0),
    });
  }, [activeStatusView, draggedStatusItemId]);

  const handleStatusDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const itemId =
      event.dataTransfer.getData("application/x-lyceum-status-item") ||
      event.dataTransfer.getData("text/plain") ||
      draggedStatusItemId;
    const target = statusDropTarget;

    setDraggedStatusItemId(null);
    setStatusDropTarget(null);

    if (!itemId || !target) return;

    void handleStatusMutation(
      () => window.api.positionReadingStatusItem(itemId, target.status, target.index),
      "Ordem atualizada",
    );
  }, [draggedStatusItemId, handleStatusMutation, statusDropTarget]);

  if (!apiAvailable) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-6 text-sm text-zinc-500">
        Atlas esta disponivel no app desktop.
      </div>
    );
  }

  const loading =
    booksQuery.isLoading ||
    booksQuery.isFetching ||
    mapQuery.isLoading ||
    mapQuery.isFetching ||
    statusQuery.isFetching;
  const canDragRoadmap = statusFilter === "all";
  const filteredSections = (payload?.sections ?? []).map((section) => ({
    ...section,
    items: statusFilter === "all"
      ? section.items
      : section.items.filter((item) => item.status === statusFilter),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900">
            <BookMarked size={20} className="text-green-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Atlas</h1>
            {/* <p className="text-sm text-zinc-500">
              {view === "roadmap"
                ? "Construa trilhas de leitura por etapas."
                : "Organize a biblioteca por estado de leitura."}
            </p> */}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-sm border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setView("roadmap")}
              className={`h-8 cursor-pointer rounded-sm px-3 text-sm ${view === "roadmap" ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
            >
              Roadmap
            </button>
            <button
              type="button"
              onClick={() => setView("status")}
              className={`h-8 cursor-pointer rounded-sm px-3 text-sm ${view === "status" ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
            >
              Estados
            </button>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </header>

      {view === "status" ? (
        <StatusBoardView
          items={statusItems}
          activeStatus={activeStatusView}
          selectedItemId={selectedStatusItemId}
          search={statusSearch}
          loading={statusQuery.isLoading || statusQuery.isFetching}
          readings={readings}
          vaultPath={atlasVaultPath}
          noteContent={noteQuery.data?.content || ""}
          notePath={noteQuery.data?.notePath || null}
          noteLoading={noteQuery.isLoading || noteQuery.isFetching}
          noteSaving={noteSaving}
          draggedItemId={draggedStatusItemId}
          dropTarget={statusDropTarget}
          onActiveStatusChange={(status) => {
            setActiveStatusView(status);
            setStatusSearch("");
          }}
          onSearchChange={setStatusSearch}
          onSelectItem={setSelectedStatusItemId}
          onAddLibrary={() => setLibraryPickerTarget({ kind: "status", status: activeStatusView })}
          onAddManual={() => setManualDialogTarget({ kind: "status", status: activeStatusView })}
          onChooseVault={handleChooseVault}
          onSaveNote={handleSaveNote}
          onOpen={handleOpenBook}
          onStatusChange={(itemId, status) =>
            handleStatusMutation(
              () => window.api.updateReadingStatusItemStatus(itemId, status),
              `Movido para ${statusLabel(status)}`,
            )
          }
          onDelete={(itemId) =>
            handleStatusMutation(
              () => window.api.deleteReadingStatusItem(itemId),
              "Livro removido dos estados",
            )
          }
          onSetPrimary={(itemId) =>
            handleStatusMutation(
              () => window.api.setPrimaryReadingStatusItem(itemId),
              "Leitura principal definida",
            )
          }
          onCoverChange={handleCoverChange}
          onMetadataSearch={setMetadataTarget}
          onProgressSave={(itemId, updates) =>
            handleStatusMutation(
              () => window.api.updateReadingStatusItemProgress(itemId, updates),
              "Progresso atualizado",
            )
          }
          onProgressEvent={(itemId, pages) =>
            handleStatusMutation(
              () => window.api.addReadingStatusProgressEvent(itemId, pages),
              "Registro somado",
            )
          }
          onDragStart={handleStatusDragStart}
          onDragEnd={handleStatusDragEnd}
          onDragOverItem={handleStatusDragOverItem}
          onDragOverBoard={handleStatusDragOverBoard}
          onDrop={handleStatusDrop}
        />
      ) : (
        <>
          <RoadmapBoard
            payload={payload}
            sections={filteredSections}
            activeSection={activeSection}
            stats={stats}
            isLoading={mapQuery.isLoading}
            hasError={Boolean(mapQuery.error)}
            zoom={zoom}
            statusFilter={statusFilter}
            canDrag={canDragRoadmap}
            draggedItemId={draggedItemId}
            dropTarget={dropTarget}
            onMapChange={setSelectedMapId}
            onNewMap={() => setMapDialogOpen(true)}
            onNewSection={() => setSectionDialogOpen(true)}
            onAddLibraryBook={() => activeSection ? setLibraryPickerTarget({ kind: "roadmap", sectionId: activeSection.id }) : toast.error("Selecione uma etapa")}
            onAddManualBook={() => activeSection ? setManualDialogTarget({ kind: "roadmap", sectionId: activeSection.id }) : toast.error("Selecione uma etapa")}
            onStatusFilterChange={setStatusFilter}
            onZoomChange={setZoom}
            onActiveSectionChange={setActiveSectionId}
            onOpenBook={handleOpenBook}
            onSectionSave={(sectionId, updates) =>
              handleMapMutation(
                () => window.api.updateReadingMapSection(sectionId, updates),
                "Etapa atualizada",
              )
            }
            onItemStatusChange={(itemId, status) =>
              handleMapMutation(
                () => window.api.updateReadingMapItemStatus(itemId, status),
                `Movido para ${statusLabel(status)}`,
              )
            }
            onItemDelete={(itemId) =>
              handleMapMutation(
                () => window.api.deleteReadingMapItem(itemId),
                "Livro removido do mapa",
              )
            }
            onDragStart={handleRoadmapDragStart}
            onDragEnd={handleRoadmapDragEnd}
            onDragOverItem={handleRoadmapDragOverItem}
            onDragOverSection={handleRoadmapDragOverSection}
            onDrop={handleRoadmapDrop}
          />

          <SimpleTextDialog
            open={mapDialogOpen}
            title="Novo mapa"
            titlePlaceholder="Nome do mapa"
            descriptionPlaceholder="Descricao opcional"
            submitLabel="Criar mapa"
            onClose={() => setMapDialogOpen(false)}
            onSubmit={(values) => {
              setMapDialogOpen(false);
              handleMapMutation(
                () => window.api.createReadingMap(values.title, values.description),
                "Mapa criado",
              );
            }}
          />
          <SimpleTextDialog
            open={sectionDialogOpen}
            title="Nova etapa"
            titlePlaceholder="Nome da etapa"
            descriptionPlaceholder="Descricao e objetivo da etapa"
            submitLabel="Criar etapa"
            onClose={() => setSectionDialogOpen(false)}
            onSubmit={(values) => {
              if (!payload?.activeMap) return;
              setSectionDialogOpen(false);
              handleMapMutation(
                () => window.api.createReadingMapSection(payload.activeMap.id, values.title, values.description),
                "Etapa criada",
              );
            }}
          />
        </>
      )}

      <LibraryPickerDialog
        open={Boolean(libraryPickerTarget)}
        books={booksQuery.data ?? []}
        onClose={() => setLibraryPickerTarget(null)}
        onSelect={(book) => {
          const target = libraryPickerTarget;
          if (!target) return;
          setLibraryPickerTarget(null);

          if (target.kind === "roadmap") {
            handleMapMutation(
              () => window.api.addLibraryBookToReadingMap(target.sectionId, book.fileHash),
              "Livro adicionado ao mapa",
            );
            return;
          }

          handleStatusMutation(
            () => window.api.addLibraryBookToReadingStatus(target.status, book.fileHash),
            "Livro adicionado aos estados",
          );
        }}
      />
      <ManualBookDialog
        open={Boolean(manualDialogTarget)}
        initialStatus={manualDialogTarget?.kind === "status" ? manualDialogTarget.status : "want_to_read"}
        onClose={() => setManualDialogTarget(null)}
        onSubmit={(data) => {
          const target = manualDialogTarget;
          if (!target) return;
          setManualDialogTarget(null);

          if (target.kind === "roadmap") {
            handleMapMutation(
              () => window.api.addManualBookToReadingMap(target.sectionId, data),
              "Livro manual adicionado",
            );
            return;
          }

          handleStatusMutation(
            () => window.api.addManualBookToReadingStatus({ ...data, status: data.status || target.status }),
            "Livro manual adicionado",
          );
        }}
      />
      <SetThumbnailDialog
        isOpen={thumbnailDialog.open}
        imagePath={thumbnailDialog.imagePath}
        onSetThumbnail={handleSetStatusCover}
        onClose={() => {
          setThumbnailDialog({ open: false, imagePath: "" });
          setCoverTarget(null);
        }}
      />
      {metadataTarget && (
        <BookMetadataSearchDialog
          isOpen={Boolean(metadataTarget)}
          book={metadataTarget.book || createSyntheticBook(metadataTarget)}
          thumbnail={getManualCoverSrc(metadataTarget.coverPath) || undefined}
          onClose={() => setMetadataTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ["atlas-status-note", selectedStatusItemId] });
            setMetadataTarget(null);
          }}
          onSaveMetadata={metadataTarget.book ? undefined : (metadata) => handleManualMetadataSave(metadataTarget, metadata)}
        />
      )}
    </div>
  );
}
