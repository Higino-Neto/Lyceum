import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, ChevronsDown, ChevronsRight } from "lucide-react";

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

interface FolderTreeProps {
  selectedFolder: string | null;
  onFolderSelect: (folderPath: string | null) => void;
}

function countAllBooks(folder: FolderInfo): number {
  return folder.bookCount + folder.subfolders.reduce((acc, f) => acc + countAllBooks(f), 0);
}

export default function FolderTree({ selectedFolder, onFolderSelect }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const loadFolders = async () => {
    setLoading(true);
    try {
      const structure = await window.api.getFolderStructure();
      const filtered = structure.filter(f => !f.name.startsWith("."));
      
      const initialExpanded = new Set<string>();
      filtered.forEach(f => {
        if (f.subfolders.length > 0) initialExpanded.add(f.path);
      });
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

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const allExpanded = folders.length > 0 && folders.every(f => expandedPaths.has(f.path) || f.subfolders.length === 0);

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedPaths(new Set());
    } else {
      const allPaths = new Set<string>();
      const collectPaths = (folders: FolderInfo[]) => {
        folders.forEach(f => {
          if (f.subfolders.length > 0) {
            allPaths.add(f.path);
            collectPaths(f.subfolders);
          }
        });
      };
      collectPaths(folders);
      setExpandedPaths(allPaths);
    }
  };

  const totalBooks = folders.reduce((acc, f) => acc + countAllBooks(f), 0);

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
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pastas</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleExpandAll}
            className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title={allExpanded ? "Recolher todas" : "Expandir todas"}
          >
            {allExpanded ? <ChevronsDown size={14} /> : <ChevronsRight size={14} />}
          </button>
          <button
            onClick={loadFolders}
            className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="p-4 text-center text-xs text-zinc-500 cursor-default">
          Nenhuma pasta na biblioteca
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto py-2 px-1">
            <button
              onClick={() => onFolderSelect(null)}
              className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm mb-1 transition-colors cursor-pointer ${
                selectedFolder === null
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <Folder size={16} className="text-zinc-500" />
              <span className="flex-1 text-left">Todas as pastas</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                selectedFolder === null ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800 text-zinc-500"
              }`}>
                {totalBooks}
              </span>
            </button>

            {folders.map((folder) => (
              <FolderNode
                key={folder.path}
                folder={folder}
                selectedPath={selectedFolder}
                onSelect={onFolderSelect}
                level={0}
                expandedPaths={expandedPaths}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
          
          <div className="px-3 py-2 border-t border-zinc-800 text-xs text-zinc-500 cursor-default">
            {folders.length} pasta{folders.length !== 1 ? "s" : ""} • {totalBooks} livro{totalBooks !== 1 ? "s" : ""}
          </div>
        </>
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
}: {
  folder: FolderInfo;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  level: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string, e: React.MouseEvent) => void;
}) {
  const hasChildren = folder.subfolders.length > 0;
  const isExpanded = expandedPaths.has(folder.path);
  
  const isSelected = folder.path === selectedPath;

  const totalBooks = countAllBooks(folder);

  return (
    <div className="mb-0.5">
      <div
        className={`flex items-center gap-1.5 cursor-pointer rounded-sm transition-colors ${
          isSelected
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: "8px", paddingTop: "6px", paddingBottom: "6px" }}
        onClick={() => onSelect(folder.path)}
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

        <Folder size={15} className={isSelected ? "text-zinc-300" : "text-zinc-500"} />
        
        <span className="flex-1 truncate text-sm">{folder.name}</span>
        
        <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
          isSelected ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800 text-zinc-500"
        }`}>
          {totalBooks}
        </span>
      </div>

      {isExpanded && folder.subfolders.length > 0 && (
        <div>
          {folder.subfolders
            .filter(f => !f.name.startsWith("."))
            .map((subfolder) => (
              <FolderNode
                key={subfolder.path}
                folder={subfolder}
                selectedPath={selectedPath}
                onSelect={onSelect}
                level={level + 1}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
              />
            ))}
        </div>
      )}
    </div>
  );
}