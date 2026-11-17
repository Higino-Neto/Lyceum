import { lazy, Suspense, useCallback, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, Languages, LayoutDashboard, LibraryBig, Target, Users, type LucideIcon } from "lucide-react";
import { SelectedUsersProvider } from "../../contexts/SelectedUsersContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useTranslation, type TranslationKey } from "../../i18n";
import OverviewTab from "./tabs/OverviewTab";
import "./dashboard.css";

// Statistic tabs load on demand so the overview stays as fast as before.
const ReadingTab = lazy(() => import("./tabs/ReadingTab"));
const LanguageTab = lazy(() => import("./tabs/LanguageTab"));
const LibraryTab = lazy(() => import("./tabs/LibraryTab"));
const GoalsTab = lazy(() => import("./tabs/GoalsTab"));
const FriendsTab = lazy(() => import("./tabs/FriendsTab"));

export type DashboardTabId = "overview" | "reading" | "languages" | "library" | "goals" | "friends";

const TABS: Array<{ id: DashboardTabId; labelKey: TranslationKey; icon: LucideIcon; component: ComponentType }> = [
  { id: "overview", labelKey: "dashboard:tabs.overview", icon: LayoutDashboard, component: OverviewTab },
  { id: "reading", labelKey: "dashboard:tabs.reading", icon: BookOpen, component: ReadingTab },
  { id: "languages", labelKey: "dashboard:tabs.languages", icon: Languages, component: LanguageTab },
  { id: "library", labelKey: "dashboard:tabs.library", icon: LibraryBig, component: LibraryTab },
  { id: "goals", labelKey: "dashboard:tabs.goals", icon: Target, component: GoalsTab },
  { id: "friends", labelKey: "dashboard:tabs.friends", icon: Users, component: FriendsTab },
];

function isTabId(value: string | null): value is DashboardTabId {
  return TABS.some((tab) => tab.id === value);
}

function TabFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastTab, setLastTab] = useLocalStorage<DashboardTabId>("dashboard_tab", "overview");
  const fromUrl = searchParams.get("tab");
  const activeTab: DashboardTabId = isTabId(fromUrl) ? fromUrl : isTabId(lastTab) ? lastTab : "overview";
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component ?? OverviewTab;

  const selectTab = useCallback((id: DashboardTabId) => {
    setLastTab(id);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (id === "overview") next.delete("tab");
      else next.set("tab", id);
      return next;
    }, { replace: true });
  }, [setLastTab, setSearchParams]);

  return (
    <SelectedUsersProvider>
      <motion.div
        className="min-h-screen bg-background text-foreground"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
      >
        <main className="flex-1 overflow-auto p-4">
          <nav
            role="tablist"
            aria-label={t("dashboard:tabs.label")}
            className="mb-4 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
          >
            {TABS.map(({ id, labelKey, icon: Icon }) => {
              const selected = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(id)}
                  className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${
                    selected
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-foreground-subtle hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  {t(labelKey)}
                </button>
              );
            })}
          </nav>

          <div role="tabpanel" className="dashboard-viz">
            <Suspense fallback={<TabFallback />}>
              <ActiveComponent />
            </Suspense>
          </div>
        </main>
      </motion.div>
    </SelectedUsersProvider>
  );
}
