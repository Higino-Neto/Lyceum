import {
  ChevronsDown,
  ChevronsRight,
  FilePlus,
  FolderOpen,
  FolderPlus,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";

export default function FolderTreeToolbar({
  allExpanded,
  syncing,
  canAddSource,
  canImport,
  onCreateRoot,
  onImportRoot,
  onAddSource,
  onToggleExpandAll,
  onResync,
}: {
  allExpanded: boolean;
  syncing: boolean;
  canAddSource: boolean;
  canImport: boolean;
  onCreateRoot: () => void;
  onImportRoot: () => void;
  onAddSource: () => void;
  onToggleExpandAll: () => void;
  onResync: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FolderOpen size={16} className="text-zinc-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Pastas
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton title="Criar nova pasta" onClick={onCreateRoot}>
          <FolderPlus size={14} />
        </IconButton>
        {canImport && (
          <IconButton title="Adicionar livro" onClick={onImportRoot}>
            <FilePlus size={14} />
          </IconButton>
        )}
        {canAddSource && (
          <IconButton title="Adicionar pasta fonte" onClick={onAddSource}>
            <HardDrive size={14} />
          </IconButton>
        )}
        <IconButton
          title={allExpanded ? "Recolher todas" : "Expandir todas"}
          onClick={onToggleExpandAll}
        >
          {allExpanded ? <ChevronsDown size={14} /> : <ChevronsRight size={14} />}
        </IconButton>
        <IconButton title={syncing ? "Sincronizando..." : "Sincronizar"} onClick={onResync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-sm p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
      title={title}
    >
      {children}
    </button>
  );
}
