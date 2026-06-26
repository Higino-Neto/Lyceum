import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Download, Library, Palette, SlidersHorizontal, UserCircle, Users, X, ZoomIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePendingFriendRequestCount } from "../../hooks/useFriends";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import FriendsSettingsPanel from "./FriendsSettingsPanel";
import {
  AccountSettingsPanel,
  AppearanceSettingsPanel,
  DictionarySettingsPanel,
  GeneralSettingsPanel,
  LibrarySettingsPanel,
  UpdatesSettingsPanel,
  ZoomSettingsPanel,
} from "./SettingsPanels";

export type SettingsTabId = "general" | "library" | "updates" | "account" | "friends" | "appearance" | "zoom" | "dictionaries";

const SETTINGS_TAB_IDS = new Set<SettingsTabId>([
  "general",
  "library",
  "updates",
  "account",
  "friends",
  "appearance",
  "zoom",
  "dictionaries",
]);

function isSettingsTabId(value: unknown): value is SettingsTabId {
  return typeof value === "string" && SETTINGS_TAB_IDS.has(value as SettingsTabId);
}

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  panel: ReactNode;
  badgeCount?: number;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
  initialFriendId?: string | null;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  initialTab,
  initialFriendId = null,
}: SettingsDialogProps) {
  const [storedActiveTab, setStoredActiveTab] = useLocalStorage<SettingsTabId>(
    "settings_active_tab",
    "general",
  );
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(() =>
    isSettingsTabId(initialTab) ? initialTab : storedActiveTab,
  );
  const { data: pendingFriendRequests = 0 } =
    usePendingFriendRequestCount(isOpen);

  const setActiveTab = (tab: SettingsTabId) => {
    setActiveTabState(tab);
    setStoredActiveTab(tab);
  };

  useEffect(() => {
    if (!isOpen) return;

    const nextTab = isSettingsTabId(initialTab) ? initialTab : storedActiveTab;
    setActiveTabState(nextTab);
    setStoredActiveTab(nextTab);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [initialTab, isOpen, onClose, setStoredActiveTab, storedActiveTab]);

  const tabs = useMemo<SettingsTab[]>(
    () => [
      {
        id: "general",
        label: "Geral",
        description: "Configurações gerais do aplicativo.",
        icon: SlidersHorizontal,
        panel: <GeneralSettingsPanel />,
      },
      {
        id: "library",
        label: "Biblioteca",
        description: "Comportamento de pastas e livros na biblioteca.",
        icon: Library,
        panel: <LibrarySettingsPanel />,
      },
      {
        id: "updates",
        label: "Atualizacoes",
        description: "Busque, baixe e instale novas versoes do Lyceum.",
        icon: Download,
        panel: <UpdatesSettingsPanel />,
      },
      {
        id: "account",
        label: "Conta",
        description: "Dados pessoais, segurança e sessão.",
        icon: UserCircle,
        panel: <AccountSettingsPanel onRequestClose={onClose} />,
      },
      {
        id: "friends",
        label: "Amigos",
        description: "Nicknames, solicitacoes e competicao com amigos.",
        icon: Users,
        badgeCount: pendingFriendRequests,
        panel: <FriendsSettingsPanel focusedFriendId={initialFriendId} />,
      },
      {
        id: "appearance",
        label: "Aparência",
        description: "Tema e cor de destaque da interface.",
        icon: Palette,
        panel: <AppearanceSettingsPanel />,
      },
      {
        id: "zoom",
        label: "Zoom",
        description: "Ajuste de zoom da interface.",
        icon: ZoomIn,
        panel: <ZoomSettingsPanel />,
      },
      {
        id: "dictionaries",
        label: "Dicionários",
        description: "Pacotes offline para leitura.",
        icon: BookOpen,
        panel: <DictionarySettingsPanel />,
      },
    ],
    [initialFriendId, onClose, pendingFriendRequests],
  );

  const activeSettingsTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="flex h-[min(760px,calc(100vh-48px))] w-full max-w-5xl overflow-hidden rounded border border-zinc-700/90 bg-zinc-900 text-zinc-100 shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="hidden w-60 shrink-0 border-r border-zinc-800 bg-zinc-950/80 p-3 sm:block">
          <div className="mb-4 flex h-10 items-center gap-2 px-2">
            <SlidersHorizontal size={18} className="text-zinc-400" />
            <h2 className="text-base font-semibold">
              Configurações
            </h2>
          </div>

          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.badgeCount ? (
                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[11px] font-semibold text-black">
                      {tab.badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-zinc-900">
          <header className="flex min-h-14 items-center justify-between border-b border-zinc-800 px-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="settings-title" className="truncate text-base font-semibold text-zinc-100">
                Configurações
              </h2>
              <p className="hidden text-xs text-zinc-500 sm:block">
                {activeSettingsTab.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activeTab}
                onChange={(event) =>
                  setActiveTab(event.target.value as SettingsTabId)
                }
                className="h-9 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 sm:hidden"
                aria-label="Selecionar aba"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.badgeCount
                      ? `${tab.label} (${tab.badgeCount})`
                      : tab.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                title="Fechar"
                aria-label="Fechar configurações"
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">
                  {activeSettingsTab.label}
                </h1>
                <p className="mt-1 text-sm text-zinc-500 sm:hidden">
                  {activeSettingsTab.description}
                </p>
              </div>

              {activeSettingsTab.panel}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
