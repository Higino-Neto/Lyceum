import {
  useCallback,
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useGetReadings from "../../hooks/useGetReadings";
import type {
  BookWithThumbnail,
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
import {
  LibraryPickerDialog,
  ManualBookDialog,
} from "./components/AtlasDialogs";
import {
  ATLAS_BOOKS_QUERY_KEY,
  ATLAS_STATUS_QUERY_KEY,
  statusLabel,
  type AddTarget,
  type StatusDropTarget,
} from "./atlasTypes";
import {
  createSyntheticBook,
  fetchAtlasBooks,
  fetchReadingStatusItems,
  getManualCoverSrc,
  getNavigationId,
} from "./atlasUtils";

export default function AtlasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStatusView, setActiveStatusView] = useState<ReadingStatus>("reading");
  const [statusSearch, setStatusSearch] = useState("");
  const [selectedStatusItemId, setSelectedStatusItemId] = useState<string | null>(null);
  const [coverTarget, setCoverTarget] = useState<ReadingStatusItem | null>(null);
  const [thumbnailDialog, setThumbnailDialog] = useState<{ open: boolean; imagePath: string }>({ open: false, imagePath: "" });
  const [metadataTarget, setMetadataTarget] = useState<ReadingStatusItem | null>(null);
  const [draggedStatusItemId, setDraggedStatusItemId] = useState<string | null>(null);
  const [statusDropTarget, setStatusDropTarget] = useState<StatusDropTarget>(null);
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<AddTarget | null>(null);
  const [manualDialogTarget, setManualDialogTarget] = useState<AddTarget | null>(null);
  const apiAvailable = Boolean(window.api?.listBooks);
  const statusApiAvailable = Boolean(window.api?.getReadingStatusItems);

  const booksQuery = useQuery({
    queryKey: ATLAS_BOOKS_QUERY_KEY,
    queryFn: fetchAtlasBooks,
    enabled: apiAvailable,
    staleTime: 20_000,
  });

  const readingsQuery = useGetReadings();

  const statusQuery = useQuery({
    queryKey: ATLAS_STATUS_QUERY_KEY,
    queryFn: fetchReadingStatusItems,
    enabled: apiAvailable && statusApiAvailable,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!window.api?.onLibraryUpdated) return undefined;
    return window.api.onLibraryUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    });
  }, [queryClient]);

  useEffect(() => {
    const activeItems = (statusQuery.data?.items ?? []).filter((item) => item.status === activeStatusView);
    if (selectedStatusItemId && activeItems.some((item) => item.id === selectedStatusItemId)) return;
    setSelectedStatusItemId(activeItems.find((item) => item.isPrimary)?.id || activeItems[0]?.id || null);
  }, [activeStatusView, selectedStatusItemId, statusQuery.data?.items]);

  const statusItems = statusQuery.data?.items ?? [];
  const cachedReadings = queryClient.getQueryData<TableReading[]>(["readings"]) ?? [];
  const readings = readingsQuery.data ?? cachedReadings;

  const applyStatusResult = useCallback((result: { success: boolean; payload?: ReadingStatusPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      toast.error(result.error || "Erro ao atualizar estados");
      return;
    }

    queryClient.setQueryData(ATLAS_STATUS_QUERY_KEY, result.payload);
    queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
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

  const handleCoverChange = useCallback(async (item: ReadingStatusItem) => {
    try {
      const imagePath = await window.api.openImageDialog();
      if (!imagePath) return;

      if (!item.book) {
        const result = await window.api.updateReadingStatusItemCover(item.id, imagePath);
        applyStatusResult(result);
        if (result.success) toast.success("Capa atualizada");
        return;
      }

      setCoverTarget(item);
      setThumbnailDialog({ open: true, imagePath });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao selecionar capa");
    }
  }, [applyStatusResult]);

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

  const handleRatingChange = useCallback(async (itemId: string, rating: number) => {
    const item = statusItems.find((i) => i.id === itemId);
    if (!item) return;

    try {
      if (item.bookId && item.book) {
        await window.api.updateRating(item.book.fileHash, rating);
      }
      await handleStatusMutation(
        () => window.api.updateReadingStatusItemMetadata(itemId, { rating }),
        undefined,
      );
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar nota");
    }
  }, [handleStatusMutation, queryClient, statusItems]);

  if (!apiAvailable) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-6 text-sm text-zinc-500">
        Atlas esta disponivel no app desktop.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900">
            <BookMarked size={20} className="text-green-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Atlas</h1>
          </div>
        </div>
      </header>

      <StatusBoardView
        items={statusItems}
        activeStatus={activeStatusView}
        selectedItemId={selectedStatusItemId}
        search={statusSearch}
        loading={statusQuery.isLoading || statusQuery.isFetching}
        readings={readings}
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
            "Livro removido",
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
            "Registro adicionado",
          )
        }
        onRatingChange={handleRatingChange}
        onDragStart={handleStatusDragStart}
        onDragEnd={handleStatusDragEnd}
        onDragOverItem={handleStatusDragOverItem}
        onDragOverBoard={handleStatusDragOverBoard}
        onDrop={handleStatusDrop}
      />

      <LibraryPickerDialog
        open={Boolean(libraryPickerTarget)}
        books={booksQuery.data ?? []}
        onClose={() => setLibraryPickerTarget(null)}
        onSelect={(book) => {
          const target = libraryPickerTarget;
          if (!target) return;
          setLibraryPickerTarget(null);

          handleStatusMutation(
            () => window.api.addLibraryBookToReadingStatus(target.status, book.fileHash),
            "Livro adicionado",
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
            setMetadataTarget(null);
          }}
          onSaveMetadata={metadataTarget.book ? undefined : (metadata) => handleManualMetadataSave(metadataTarget, metadata)}
        />
      )}
    </div>
  );
}
