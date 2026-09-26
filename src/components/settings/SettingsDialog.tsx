import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, DatabaseBackup, Download, FlaskConical, Gauge, Keyboard, Library, Palette, SlidersHorizontal, UserCircle, Users, X, ZoomIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePendingFriendRequestCount } from "../../hooks/useFriends";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import FriendsSettingsPanel from "./FriendsSettingsPanel";
import {
  AccountSettingsPanel,
  AppearanceSettingsPanel,
  BetaSettingsPanel,
  DictionarySettingsPanel,
  GeneralSettingsPanel,
  LibrarySettingsPanel,
  PerformanceSettingsPanel,
  BackupSettingsPanel,
  HotkeysSettingsPanel,
  UpdatesSettingsPanel,
  ZoomSettingsPanel,
} from "./SettingsPanels";
import AnimatedModal from "../ui/AnimatedModal";
import { useTranslation } from "../../i18n";

export type SettingsTabId = "general" | "hotkeys" | "backup" | "library" | "updates" | "account" | "friends" | "appearance" | "zoom" | "dictionaries" | "beta" | "performance";

const SETTINGS_TAB_IDS = new Set<SettingsTabId>([
  "general",
  "hotkeys",
  "backup",
  "library",
  "updates",
  "account",
  "friends",
  "appearance",
  "zoom",
  "dictionaries",
  "beta",
  "performance",
]);

function isSettingsTabId(value: unknown): value is SettingsTabId {
  return typeof value === "string" && SETTINGS_TAB_IDS.has(value as SettingsTabId);
}

interface SettingsTab {
  id: SettingsTabId;
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
  const { t } = useTranslation();
  const osReducedMotion = useReducedMotion();
  const reduceMotion = osReducedMotion ||
    (typeof document !== "undefined" && document.documentElement.dataset.reducedEffects === "true");
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
  }, [initialTab, isOpen, onClose, setStoredActiveTab]);

  const tabs = useMemo<SettingsTab[]>(
    () => [
      {
        id: "general",
        icon: SlidersHorizontal,
        panel: <GeneralSettingsPanel />,
      },
      {
        id: "hotkeys",
        icon: Keyboard,
        panel: <HotkeysSettingsPanel />,
      },
      {
        id: "backup",
        icon: DatabaseBackup,
        panel: <BackupSettingsPanel />,
      },
      {
        id: "beta",
        icon: FlaskConical,
        panel: <BetaSettingsPanel />,
      },
      {
        id: "library",
        icon: Library,
        panel: <LibrarySettingsPanel />,
      },
      {
        id: "updates",
        icon: Download,
        panel: <UpdatesSettingsPanel />,
      },
      {
        id: "account",
        icon: UserCircle,
        panel: <AccountSettingsPanel onRequestClose={onClose} />,
      },
      {
        id: "friends",
        icon: Users,
        badgeCount: pendingFriendRequests,
        panel: <FriendsSettingsPanel focusedFriendId={initialFriendId} />,
      },
      {
        id: "appearance",
        icon: Palette,
        panel: <AppearanceSettingsPanel />,
      },
      {
        id: "performance",
        icon: Gauge,
        panel: <PerformanceSettingsPanel />,
      },
      {
        id: "zoom",
        icon: ZoomIn,
        panel: <ZoomSettingsPanel />,
      },
      {
        id: "dictionaries",
        icon: BookOpen,
        panel: <DictionarySettingsPanel />,
      },
    ],
    [initialFriendId, onClose, pendingFriendRequests],
  );

  const tabLabel = (tab: SettingsTab) => t(`settings:tabs.${tab.id}.label`);
  const tabDescription = (tab: SettingsTab) =>
    t(`settings:tabs.${tab.id}.description`);

  const activeSettingsTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <AnimatedModal
      open={isOpen}
      ariaLabelledBy="settings-title"
      onBackdropClick={onClose}
      backdropClassName="z-[90] px-4 py-6"
      className="flex h-[min(760px,calc(100vh-48px))] w-full max-w-5xl overflow-hidden rounded border border-zinc-700/90 bg-zinc-900 text-zinc-100 shadow-2xl shadow-black/60"
    >
        <aside className="hidden w-60 shrink-0 border-r border-zinc-800 bg-zinc-950/80 p-3 sm:block">
          <div className="mb-4 flex h-10 items-center gap-2 px-2">
            <SlidersHorizontal size={18} className="text-zinc-400" />
            <h2 className="text-base font-semibold">
              {t("settings:title")}
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
                  <span>{tabLabel(tab)}</span>
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
                {t("settings:title")}
              </h2>
              <p className="hidden text-xs text-zinc-500 sm:block">
                {tabDescription(activeSettingsTab)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activeTab}
                onChange={(event) =>
                  setActiveTab(event.target.value as SettingsTabId)
                }
                className="h-9 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 sm:hidden"
                aria-label={t("settings:selectTab")}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.badgeCount
                      ? `${tabLabel(tab)} (${tab.badgeCount})`
                      : tabLabel(tab)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                title={t("settings:close")}
                aria-label={t("settings:closeLabel")}
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">
                  {tabLabel(activeSettingsTab)}
                </h1>
                <p className="mt-1 text-sm text-zinc-500 sm:hidden">
                  {tabDescription(activeSettingsTab)}
                </p>
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeSettingsTab.id}
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
                >
                  {activeSettingsTab.panel}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
    </AnimatedModal>
  );
}
