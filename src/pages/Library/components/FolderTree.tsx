import { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  ChevronsDown,
  ChevronsRight,
  Search,
  FolderPlus,
  Pencil,
  Trash2,
  MoreVertical,
  Check,
  X,
  FolderInput,
  FilePlus,
} from "lucide-react";
import { FolderInfo } from "../../../types/LibraryTypes";
import { DocumentRecord } from "../../../types/ReadingTypes";
import toast from "react-hot-toast";

interface FolderTreeProps {
  selectedFolder: string | null;
  onFolderSelect: (folderPath: string | null) => void;
  localDocuments: DocumentRecord[];
  onMoveBook?: (fileHash: string, targetFolder: string | null) => Promise<boolean>;
  draggingBookHash?: string | null;
  onImportBook?: (targetFolder: string | null) => Promise<void>;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: FolderInfo | null;
}

function countAllBooks(folder: FolderInfo): number {
  return (
    folder.bookCount +
    folder.subfolders.reduce((acc, f) => acc + countAllBooks(f), 0)
  );
}

function filterFolders(
  folders: FolderInfo[],
  searchTerm: string,
): FolderInfo[] {
  if (!searchTerm) return folders;

  const term = searchTerm.toLowerCase();

  return folders
    .map((folder) => {
      const matchesName = folder.name.toLowerCase().includes(term);
      const matchingSubfolders = filterFolders(folder.subfolders, term);

      if (matchesName || matchingSubfolders.length > 0) {
        return {
          ...folder,
          subfolders: matchingSubfolders,
        };
      }
      return null;
    })
    .filter((f): f is FolderInfo => f !== null);
}

function flattenFolders(folders: FolderInfo[]): FolderInfo[] {
  const result: FolderInfo[] = [];

  const traverse = (items: FolderInfo[]) => {
    for (const item of items) {
      result.push(item);
      if (item.subfolders.length > 0) {
        traverse(item.subfolders);
      }
    }
  };

  traverse(folders);
  return result;
}

export default function FolderTree({
  selectedFolder,
  onFolderSelect,
  localDocuments,
  onMoveBook,
  draggingBookHash,
  onImportBook,
}: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    folder: null,
  });
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  const [creatingFolderAt, setCreatingFolderAt] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    folder: FolderInfo | null;
  }>({ open: false, folder: null });

  const draggingBook = draggingBookHash || null;

  const isDropTarget = dragOver === "root";

  const loadFolders = async () => {
    setLoading(true);
    try {
      const structure = await window.api.getFolderStructure();
      const filtered = structure.filter((f) => !f.name.startsWith("."));

      const initialExpanded = new Set<string>();
      const collectPaths = (items: FolderInfo[]) => {
        items.forEach((f) => {
          if (f.subfolders.length > 0) {
            initialExpanded.add(f.path);
            collectPaths(f.subfolders);
          }
        });
      };
      collectPaths(filtered);

      setExpandedPaths(initialExpanded);
      setFolders(filtered);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const filteredFolders = useMemo(() => {
    return filterFolders(folders, searchTerm);
  }, [folders, searchTerm]);

  const filteredFlatFolders = useMemo(() => {
    return flattenFolders(filteredFolders);
  }, [filteredFolders]);

  useEffect(() => {
    if (selectedFolder && searchTerm) {
      const folder = filteredFlatFolders.find((f) => f.path === selectedFolder);
      if (!folder) {
        const parent = filteredFlatFolders.find((f) =>
          selectedFolder.startsWith(f.path),
        );
        if (parent && !expandedPaths.has(parent.path)) {
          setExpandedPaths((prev) => new Set([...prev, parent.path]));
        }
      }
    }
  }, [selectedFolder, searchTerm, filteredFlatFolders]);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const allExpanded =
    filteredFolders.length > 0 &&
    filteredFolders.every(
      (f) => expandedPaths.has(f.path) || f.subfolders.length === 0,
    );

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedPaths(new Set());
    } else {
      const allPaths = new Set<string>();
      const collectPaths = (items: FolderInfo[]) => {
        items.forEach((f) => {
          if (f.subfolders.length > 0) {
            allPaths.add(f.path);
            collectPaths(f.subfolders);
          }
        });
      };
      collectPaths(filteredFolders);
      setExpandedPaths(allPaths);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folder: FolderInfo) => {
    e.preventDefault();
    console.log("[FolderTree] Context menu folder:", folder);
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      folder,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, folder: null });
  };

  const handleRename = () => {
    if (contextMenu.folder) {
      setRenamingFolder(contextMenu.folder.fullPath);
      setRenameValue(contextMenu.folder.name);
    }
    closeContextMenu();
  };

  const handleDeleteClick = () => {
    if (contextMenu.folder) {
      setDeleteDialog({ open: true, folder: contextMenu.folder });
    }
    closeContextMenu();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.folder) return;
    
    const folderPath = deleteDialog.folder.fullPath;
    try {
      const result = await window.api.deleteFolder(folderPath, true);
      if (result.success) {
        toast.success("Pasta excluída");
        loadFolders();
        if (selectedFolder === deleteDialog.folder.path) {
          onFolderSelect(null);
        }
      } else {
        toast.error(result.error || "Erro ao excluir pasta");
      }
    } catch (error) {
      toast.error("Erro ao excluir pasta");
    }
    setDeleteDialog({ open: false, folder: null });
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, folder: null });
  };

  const handleCreateFolderAt = async (parentPath: string | null) => {
    if (!newFolderName.trim()) {
      setCreatingFolderAt(parentPath);
      return;
    }

    const apiParentPath = parentPath === "" ? null : parentPath;

    try {
      const result = await window.api.createFolder(newFolderName.trim(), apiParentPath);
      if (result.success) {
        toast.success("Pasta criada");
        loadFolders();
        setNewFolderName("");
        setCreatingFolderAt(null);
      } else {
        toast.error(result.error || "Erro ao criar pasta");
      }
    } catch (error) {
      toast.error("Erro ao criar pasta");
    }
    closeContextMenu();
  };

  const cancelCreateFolder = () => {
    setCreatingFolderAt(null);
    setNewFolderName("");
  };

  const handleDragStart = (path: string) => {
    setDraggingFolder(path);
  };

  const handleDragEnd = () => {
    setDraggingFolder(null);
    setDragOver(null);
  };

  const handleDragOver = (path: string) => {
    if (draggingFolder && path !== draggingFolder && !draggingFolder.startsWith(path)) {
      setDragOver(path);
    } else if (draggingBook) {
      setDragOver(path);
    }
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = async (targetPath: string) => {
    if (draggingFolder) {
      try {
        const result = await window.api.moveFolder(draggingFolder, targetPath);
        if (result.success) {
          toast.success("Pasta movida");
          loadFolders();
        } else {
          toast.error(result.error || "Erro ao mover pasta");
        }
      } catch (error) {
        toast.error("Erro ao mover pasta");
      }
    } else if (draggingBook && onMoveBook) {
      try {
        const success = await onMoveBook(draggingBook, targetPath);
        if (success) {
          toast.success("Livro movido");
        }
      } catch (error) {
        toast.error("Erro ao mover livro");
      }
    }

    setDraggingFolder(null);
    setDragOver(null);
  };

  const submitRename = async () => {
    if (!renamingFolder || !renameValue.trim()) {
      setRenamingFolder(null);
      return;
    }

    try {
      console.log(
        "[FolderTree] Renaming:",
        renamingFolder,
        "to:",
        renameValue.trim(),
      );
      const result = await window.api.renameFolder(
        renamingFolder,
        renameValue.trim(),
      );
      console.log("[FolderTree] Rename result:", result);
      if (result.success) {
        toast.success("Pasta renomeada");
        loadFolders();
      } else {
        toast.error(result.error || "Erro ao renomear pasta");
      }
    } catch (error) {
      console.error("[FolderTree] Rename error:", error);
      toast.error("Erro ao renomear pasta");
    }

    setRenamingFolder(null);
    setRenameValue("");
  };

  const handleResync = async () => {
    setSyncing(true);
    try {
      const result = await window.api.resyncLibrary();
      toast.success(
        `Sincronizado: +${result.added} | -${result.removed} | ${result.updated} atualizados`,
      );
      loadFolders();
    } catch (error) {
      console.error("[FolderTree] Resync error:", error);
      toast.error("Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu.visible]);

  const [libraryPath, setLibraryPath] = useState<string>("");

  useEffect(() => {
    window.api.getLibraryPath().then(setLibraryPath);
  }, []);

  const countDocsInFolder = (folderPath: string | null): number => {
    if (!libraryPath || !localDocuments.length) return 0;

    const targetPath = folderPath
      ? `${libraryPath}\\${folderPath.replace(/\//g, "\\")}`
      : libraryPath;

    return localDocuments.filter((doc) => {
      if (!doc.filePath) return false;
      const docDir = doc.filePath.substring(0, doc.filePath.lastIndexOf("\\"));
      return docDir === targetPath || docDir.startsWith(targetPath + "\\");
    }).length;
  };

  const totalBooks = useMemo(() => {
    return countDocsInFolder(null);
  }, [libraryPath, localDocuments]);

  if (loading) {
    return (
      <div className="p-3 text-xs text-zinc-500 flex items-center gap-2 cursor-wait">
        <RefreshCw size={12} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex flex-col gap-2 p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Pastas
            </span>
          </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setNewFolderName("");
                  setCreatingFolderAt("");
                }}
                className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Criar nova pasta"
              >
                <FolderPlus size={14} />
              </button>
              {onImportBook && (
                <button
                  onClick={() => onImportBook("")}
                  className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  title="Adicionar livro"
                >
                  <FilePlus size={14} />
                </button>
              )}
            <button
              onClick={toggleExpandAll}
              className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={allExpanded ? "Recolher todas" : "Expandir todas"}
            >
              {allExpanded ? (
                <ChevronsDown size={14} />
              ) : (
                <ChevronsRight size={14} />
              )}
            </button>

            <button
              onClick={handleResync}
              disabled={syncing}
              className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
              title={syncing ? "Sincronizando..." : "Sincronizar"}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar pastas..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-sm pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="flex-shrink-0 p-4 text-center text-xs text-zinc-500 cursor-default">
          Nenhuma pasta na biblioteca
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 flex-1 overflow-y-auto py-2 px-1">
            <button
              onClick={() => onFolderSelect(null)}
              className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm mb-1 transition-colors cursor-pointer ${
                selectedFolder === null
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              } ${dragOver === "root" ? "bg-green-900/50 border-2 border-green-500" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingBook) setDragOver("root");
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingBook) {
                  handleDrop("");
                }
              }}
            >
              <Folder size={16} className="text-zinc-500" />
              <span className="flex-1 text-left">Todas as pastas</span>
              <span
                className={`text-xs px-1.5 py-0.5 mr-5 rounded-sm ${
                  selectedFolder === null
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {totalBooks}
              </span>
            </button>

            {filteredFolders.map((folder) => (
              <FolderNode
                key={folder.path}
                folder={folder}
                selectedPath={selectedFolder}
                onSelect={onFolderSelect}
                level={0}
                expandedPaths={expandedPaths}
                onToggleExpand={toggleExpand}
                onContextMenu={handleContextMenu}
                renamingPath={renamingFolder}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={submitRename}
                onRenameCancel={() => {
                  setRenamingFolder(null);
                  setRenameValue("");
                }}
                searchTerm={searchTerm}
                localDocuments={localDocuments}
                libraryPath={libraryPath}
                creatingFolderAt={creatingFolderAt}
                onCreateFolder={handleCreateFolderAt}
                onCancelCreate={cancelCreateFolder}
                newFolderName={newFolderName}
                onNewFolderNameChange={setNewFolderName}
                draggingFolder={draggingFolder}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                dragOver={dragOver}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onMoveBook={onMoveBook}
              />
            ))}

            {creatingFolderAt === "" && (
              <div
                className="flex items-center gap-1.5 py-1 px-2"
                style={{ paddingLeft: "24px" }}
              >
                <Folder size={15} className="text-zinc-500" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => handleCreateFolderAt("")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolderAt("");
                    if (e.key === "Escape") cancelCreateFolder();
                  }}
                  className="flex-1 bg-zinc-700 border border-zinc-600 rounded-sm px-1.5 py-0.5 text-sm text-zinc-100 focus:outline-none"
                  autoFocus
                  placeholder="Nome da pasta"
                />
              </div>
            )}
          </div>

          <div className="flex-shrink-0 px-3 py-2 border-t border-zinc-800 text-xs text-zinc-500 cursor-default">
            <span>
              {filteredFolders.length} pasta
              {filteredFolders.length !== 1 ? "s" : ""} • {totalBooks} livro
              {totalBooks !== 1 ? "s" : ""}
            </span>
          </div>
        </>
      )}

      {contextMenu.visible && (
        <div
          className="fixed bg-zinc-800 border border-zinc-700 rounded-sm shadow-lg py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
           onClick={(e) => e.stopPropagation()}
        >
           <button
             onClick={() => {
               closeContextMenu();
               setNewFolderName("");
               setCreatingFolderAt(contextMenu.folder?.path || "");
             }}
             className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
           >
             <FolderPlus size={14} />
             Nova pasta
           </button>
           {onImportBook && (
             <button
               onClick={() => {
                 closeContextMenu();
                 onImportBook(contextMenu.folder?.path || "");
               }}
               className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
             >
               <FilePlus size={14} />
               Adicionar livro
             </button>
           )}
           <button
             onClick={handleRename}
             className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
           >
             <Pencil size={14} />
             Renomear
           </button>
           <div className="border-t border-zinc-700 my-1" />
           <button
            onClick={handleDeleteClick}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Excluir
          </button>
        </div>
      )}

      {deleteDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-sm w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <Trash2 size={20} className="text-red-400" />
                <h2 className="text-lg font-semibold text-zinc-100">Excluir pasta</h2>
              </div>
              <button
                onClick={handleDeleteCancel}
                className="p-2 hover:bg-zinc-800 rounded-sm cursor-pointer"
              >
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-zinc-400 text-sm">
                Tem certeza que deseja excluir a pasta <span className="text-zinc-200 font-medium">"{deleteDialog.folder?.name}"</span>?
              </p>
              <p className="text-zinc-500 text-xs mt-2">
                Esta pasta e todo o seu conteúdo serão excluídos permanentemente.
              </p>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-sm font-medium cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  selectedPath,
  onSelect,
  level,
  expandedPaths,
  onToggleExpand,
  onContextMenu,
  renamingPath,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  searchTerm,
  localDocuments,
  libraryPath,
  creatingFolderAt,
  onCreateFolder,
  onCancelCreate,
  newFolderName,
  onNewFolderNameChange,
  draggingFolder,
  onDragStart,
  onDragEnd,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveBook,
}: {
  folder: FolderInfo;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  level: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, folder: FolderInfo) => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  searchTerm: string;
  localDocuments: DocumentRecord[];
  libraryPath: string;
  creatingFolderAt: string | null;
  onCreateFolder: (parentPath: string | null) => void;
  onCancelCreate: () => void;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  draggingFolder: string | null;
  onDragStart: (path: string) => void;
  onDragEnd: () => void;
  dragOver: string | null;
  onDragOver: (path: string) => void;
  onDragLeave: () => void;
  onDrop: (targetPath: string) => void;
  onMoveBook?: (fileHash: string, targetFolder: string | null) => Promise<boolean>;
}) {
  const countDocsInFolder = (folderPath: string | null): number => {
    if (!libraryPath || !localDocuments.length) return 0;

    const targetPath = folderPath
      ? `${libraryPath}\\${folderPath.replace(/\//g, "\\")}`
      : libraryPath;

    return localDocuments.filter((doc) => {
      if (!doc.filePath) return false;
      const docDir = doc.filePath.substring(0, doc.filePath.lastIndexOf("\\"));
      return docDir === targetPath || docDir.startsWith(targetPath + "\\");
    }).length;
  };

  const folderBookCount = countDocsInFolder(folder.path);
  const subfoldersBooks = folder.subfolders.reduce(
    (acc, f) => acc + countDocsInFolder(f.path),
    0,
  );
  const totalBooks = folderBookCount + subfoldersBooks;

  const hasChildren = folder.subfolders.length > 0;
  const isExpanded = expandedPaths.has(folder.path);
  const isSelected = folder.path === selectedPath;
  const isRenaming = renamingPath === folder.fullPath;
  const isCreatingHere = creatingFolderAt === folder.path;
  const isCreatingRoot = creatingFolderAt === "";

  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <span key={i} className="bg-green-500/30 text-green-300">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const isDropTarget = dragOver === folder.path;
  const isDragging = draggingFolder === folder.fullPath;
  
  return (
    <div className="mb-0.5">
      <div
        className={`group flex items-center gap-1.5 cursor-pointer rounded-sm transition-colors ${
          isSelected
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        } ${isDropTarget ? "bg-green-900/50 border-2 border-green-500" : ""} ${isDragging ? "opacity-50" : ""}`}
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          paddingRight: "8px",
          paddingTop: "6px",
          paddingBottom: "6px",
        }}
        onClick={() => !isRenaming && onSelect(folder.path)}
        onContextMenu={(e) => onContextMenu(e, folder)}
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", folder.fullPath);
          onDragStart(folder.fullPath);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(folder.path);
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(folder.path);
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => onToggleExpand(folder.path, e)}
            className="p-0.5 hover:bg-zinc-700 rounded-sm hover:text-zinc-200 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {folderBookCount === 0 && subfoldersBooks === 0 ? (
          <Folder size={15} className="text-zinc-600" />
        ) : folderBookCount > 0 ? (
          <FolderOpen
            size={15}
            className={isSelected ? "text-green-400" : "text-green-500"}
          />
        ) : (
          <Folder
            size={15}
            className={isSelected ? "text-zinc-300" : "text-zinc-500"}
          />
        )}

        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onRenameCancel();
            }}
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded-sm px-1.5 py-0.5 text-sm text-zinc-100 focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : isCreatingHere ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => onNewFolderNameChange(e.target.value)}
              onBlur={() => onCreateFolder(folder.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateFolder(folder.path);
                if (e.key === "Escape") onCancelCreate();
              }}
              className="flex-1 bg-zinc-700 border border-zinc-600 rounded-sm px-1.5 py-0.5 text-sm text-zinc-100 focus:outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              placeholder="Nome da pasta"
            />
          </div>
        ) : (
          <span className="flex-1 truncate text-sm">
            {searchTerm ? highlightMatch(folder.name, searchTerm) : folder.name}
          </span>
        )}

        <div
          className={`flex items-center gap-1 text-xs ${
            isSelected ? "text-zinc-300" : "text-zinc-500"
          }`}
        >
          {subfoldersBooks > 0 && (
            <span
              className="text-[10px]"
              title={`${folder.bookCount} neste local, ${subfoldersBooks} em subpastas`}
            >
              +{subfoldersBooks}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded-sm ${
              isSelected ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800"
            }`}
          >
            {totalBooks}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, folder);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded-sm transition-opacity"
          >
            <MoreVertical size={12} />
          </button>
        </div>
      </div>

      {isExpanded && folder.subfolders.length > 0 && (
        <div>
          {folder.subfolders
            .filter((f) => !f.name.startsWith("."))
            .map((subfolder) => (
              <FolderNode
                key={subfolder.path}
                folder={subfolder}
                selectedPath={selectedPath}
                onSelect={onSelect}
                level={level + 1}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                renameValue={renameValue}
                onRenameChange={onRenameChange}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                searchTerm={searchTerm}
                localDocuments={localDocuments}
                libraryPath={libraryPath}
                creatingFolderAt={creatingFolderAt}
                onCreateFolder={onCreateFolder}
                onCancelCreate={onCancelCreate}
                newFolderName={newFolderName}
                onNewFolderNameChange={onNewFolderNameChange}
                draggingFolder={draggingFolder}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                dragOver={dragOver}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onMoveBook={onMoveBook}
              />
            ))}
        </div>
      )}
    </div>
  );
}
