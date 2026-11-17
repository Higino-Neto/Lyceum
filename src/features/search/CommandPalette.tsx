import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  Folder,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import AnimatedModal from "../../components/ui/AnimatedModal";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useTranslation } from "../../i18n";
import { getEnabledNavigationRoutes, getRouteLabel } from "../../navigation/routes";
import type { SettingsTabId } from "../../components/settings/settingsTabs";
import type { BookWithThumbnail } from "../../types/LibraryTypes";
import { fetchAllLibraryBooks } from "../../components/library/fetchAllLibraryBooks";
import { fuzzyRank, type FuzzyField } from "../../core/shared/fuzzySearch";
import { openWhatsNew } from "../whats-new/whatsNewEvents";
import { navigateToLibraryFolder, openLibraryBook } from "../library/openLibraryBook";
import { OPEN_COMMAND_PALETTE_EVENT } from "./commandPaletteEvents";

type ResultGroup = "books" | "folders" | "pages" | "settings" | "actions";

interface PaletteItem {
  id: string;
  group: ResultGroup;
  title: string;
  subtitle?: string;
  keywords?: string;
  Icon: LucideIcon;
  run: () => void | Promise<unknown>;
}

const GROUP_ORDER: ResultGroup[] = ["books", "folders", "pages", "settings", "actions"];
const GROUP_LIMIT: Record<ResultGroup, number> = { books: 8, folders: 5, pages: 6, settings: 5, actions: 5 };
const GROUP_WEIGHT: Record<ResultGroup, number> = { books: 1, folders: 0.9, pages: 1.1, settings: 0.9, actions: 0.9 };

const SETTINGS_TABS: SettingsTabId[] = [
  "general", "hotkeys", "backup", "plugins", "library", "updates", "account",
  "friends", "appearance", "performance", "zoom", "dictionaries",
];

/**
 * Global search (Ctrl/Cmd+K): books, folders, pages, settings and actions in
 * one fuzzy, accent- and typo-tolerant list.
 */
export default function CommandPalette({
  onOpenSettings,
  onOpenConversion,
}: {
  onOpenSettings: (tab?: SettingsTabId) => void;
  onOpenConversion?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, setTheme } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const apiAvailable = Boolean(window.api?.listBooks);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
    setActiveIndex(0);
  }, [open]);

  const booksQuery = useQuery({
    queryKey: ["command-palette-books"],
    queryFn: fetchAllLibraryBooks,
    enabled: open && apiAvailable,
    staleTime: 60_000,
  });
  const foldersQuery = useQuery({
    queryKey: ["command-palette-folders"],
    queryFn: async () => (window.api?.getAllFolders ? (await window.api.getAllFolders()) as string[] : []),
    enabled: open && apiAvailable,
    staleTime: 60_000,
  });

  const close = () => setOpen(false);

  const staticItems = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = getEnabledNavigationRoutes(settings).map((route) => ({
      id: `page:${route.id}`,
      group: "pages",
      title: getRouteLabel(route, t as (key: string) => string),
      Icon: LayoutDashboard,
      run: () => (route.path ? navigate(route.path) : onOpenConversion?.()),
    }));
    const settingsItems: PaletteItem[] = SETTINGS_TABS.map((tab) => ({
      id: `settings:${tab}`,
      group: "settings",
      title: t(`settings:tabs.${tab}.label`),
      subtitle: t(`settings:tabs.${tab}.description`),
      Icon: Settings,
      run: () => onOpenSettings(tab),
    }));
    const actions: PaletteItem[] = [
      { id: "action:whats-new", group: "actions", title: t("common:whatsNew.open"), Icon: Sparkles, run: openWhatsNew },
      { id: "action:theme-light", group: "actions", title: t("common:palette.themeLight"), keywords: "theme light tema claro", Icon: Sun, run: () => setTheme("light") },
      { id: "action:theme-dark", group: "actions", title: t("common:palette.themeDark"), keywords: "theme dark tema escuro", Icon: Moon, run: () => setTheme("dark") },
    ];
    if (onOpenConversion && settings.betaConversionEnabled) {
      actions.push({ id: "action:convert", group: "actions", title: t("common:palette.convert"), Icon: Zap, run: onOpenConversion });
    }
    return [...pages, ...settingsItems, ...actions];
  }, [navigate, onOpenConversion, onOpenSettings, setTheme, settings, t]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const books = booksQuery.data ?? [];
    const folders = foldersQuery.data ?? [];

    const bookItems = (list: BookWithThumbnail[]): PaletteItem[] => list.map((book) => ({
      id: `book:${book.fileHash}`,
      group: "books",
      title: book.title,
      subtitle: [book.author, book.fileType?.toUpperCase()].filter(Boolean).join(" · "),
      Icon: BookOpen,
      run: () => openLibraryBook(book, navigate),
    }));
    const folderItem = (folderPath: string): PaletteItem => ({
      id: `folder:${folderPath}`,
      group: "folders",
      title: folderPath.split(/[/\\]/).pop() || folderPath,
      subtitle: folderPath,
      Icon: Folder,
      run: () => navigateToLibraryFolder(navigate, folderPath),
    });

    if (!trimmed) {
      // Empty query: recently opened books and quick navigation.
      const recent = [...books]
        .filter((book) => book.lastOpenedAt)
        .sort((left, right) => new Date(right.lastOpenedAt!).getTime() - new Date(left.lastOpenedAt!).getTime())
        .slice(0, 6);
      return [...bookItems(recent), ...staticItems.filter((item) => item.group !== "settings")];
    }

    const scored: Array<{ item: PaletteItem; score: number }> = [];
    const push = <T,>(group: ResultGroup, list: T[], fields: (item: T) => FuzzyField[], toItem: (item: T) => PaletteItem) => {
      for (const { item, score } of fuzzyRank(list, trimmed, fields, GROUP_LIMIT[group])) {
        scored.push({ item: toItem(item), score: score * GROUP_WEIGHT[group] });
      }
    };
    push("books", books, (book) => [
      { value: book.title, weight: 3 },
      { value: book.author, weight: 2 },
      { value: book.series, weight: 1.5 },
      { value: book.fileName, weight: 1 },
    ], (book) => bookItems([book])[0]!);
    push("folders", folders, (folderPath) => [
      { value: folderPath.split(/[/\\]/).pop(), weight: 2.5 },
      { value: folderPath, weight: 1 },
    ], folderItem);
    for (const group of ["pages", "settings", "actions"] as const) {
      push(group, staticItems.filter((item) => item.group === group), (item) => [
        { value: item.title, weight: 3 },
        { value: item.subtitle, weight: 1 },
        { value: item.keywords, weight: 1 },
      ], (item) => item);
    }

    // Groups keep a fixed order; inside each group the best match is first.
    return GROUP_ORDER.flatMap((group) => scored
      .filter(({ item }) => item.group === group)
      .sort((left, right) => right.score - left.score)
      .map(({ item }) => item));
  }, [booksQuery.data, foldersQuery.data, navigate, query, staticItems]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    close();
    void item.run();
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runItem(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  let lastGroup: ResultGroup | null = null;

  return (
    <AnimatedModal
      open={open}
      ariaLabel={t("common:palette.title")}
      onBackdropClick={close}
      backdropClassName="z-[96] items-start px-4 pt-[12vh]"
      className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded border border-border-strong bg-surface text-foreground shadow-2xl shadow-shadow"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search size={17} className="flex-shrink-0 text-foreground-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t("common:palette.placeholder")}
          aria-label={t("common:palette.placeholder")}
          role="combobox"
          aria-expanded
          aria-controls="command-palette-results"
          aria-activedescendant={results[activeIndex] ? `palette-${activeIndex}` : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-input-placeholder"
        />
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground-subtle sm:block">Esc</kbd>
      </div>

      <div ref={listRef} id="command-palette-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-foreground-subtle">
            {booksQuery.isLoading ? t("common:status.loading") : t("common:palette.noResults")}
          </p>
        ) : (
          results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const active = index === activeIndex;
            return (
              <div key={item.id}>
                {header && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
                    {t(`common:palette.groups.${header}`)}
                  </p>
                )}
                <button
                  type="button"
                  id={`palette-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                  className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors ${
                    active ? "bg-surface-muted" : ""
                  }`}
                >
                  <item.Icon size={15} className={active ? "text-primary" : "text-foreground-subtle"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-[11px] text-foreground-subtle">{item.subtitle}</span>}
                  </span>
                  {active ? (
                    <CornerDownLeft size={13} className="flex-shrink-0 text-foreground-subtle" />
                  ) : (
                    <ArrowRight size={13} className="flex-shrink-0 text-transparent" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-[11px] text-foreground-subtle">
        <span>{t("common:palette.hint")}</span>
        <span className="hidden sm:inline">Ctrl+K</span>
      </div>
    </AnimatedModal>
  );
}
