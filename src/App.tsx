import { Route, Routes, useNavigate } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage/DashboardPage";
import AddReadingPage from "./pages/AddReadingPage";
import Sidebar from "./components/Sidebar";
import SignIn from "./pages/SignInPage";
import SignUp from "./pages/SignUpPage";
import ReadingPage from "./pages/ReadingPage/ReadingPage";
import Library from "./pages/Library/Library";
import HabitTrackerPage from "./pages/HabitTrackerPage/HabitTrackerPage";
import ConversionPage from "./pages/Conversion/ConversionPage";
import getUser from "./utils/getUser";
import ProtectedRoute from "./components/ProtectedRoute";
import TitleBar from "./components/TitleBar";
import SettingsDialog from "./components/settings/SettingsDialog";
import { Toaster } from "react-hot-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { getLastRoute } from "./hooks/useRouteState";
import { supabase } from "./lib/supabase";
import { useAppSettings } from "./contexts/AppSettingsContext";
import { ConversionQueueProvider } from "./contexts/ConversionQueueContext";

const AUTO_HIDE_REVEAL_DELAY_MS = 120;
const AUTO_HIDE_DISMISS_DELAY_MS = 420;
const APP_FRAME_SIZE = 7;
const AUTO_HIDE_TRIGGER_SIZE = 18;
const TITLE_BAR_HEIGHT = 40;
const SIDEBAR_COLLAPSED_WIDTH = 52;
const SIDEBAR_EXPANDED_WIDTH = 168;

function App() {
  const navigate = useNavigate();
  const { effectiveTheme, settings, setAutoHideEnabled, setAutoHideOverlay } = useAppSettings();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const showDelayTimerRef = useRef<number | null>(null);
  const hasNavigatedRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showPanels = useCallback(() => {
    if (showDelayTimerRef.current) {
      window.clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = null;
    }
    clearHideTimer();
    setPanelsVisible(true);
  }, [clearHideTimer]);

   const hidePanels = useCallback((delay = AUTO_HIDE_DISMISS_DELAY_MS, resetTimer = true) => {
     if (!resetTimer && hideTimerRef.current) {
       return;
     }

     if (resetTimer) {
       clearHideTimer();
     }

     if (settings.autoHideEnabled) {
       hideTimerRef.current = window.setTimeout(() => {
         setPanelsVisible(false);
         hideTimerRef.current = null;
       }, delay);
     }
   }, [settings.autoHideEnabled, clearHideTimer]);

  const showPanelsAfterEdgeIntent = useCallback(() => {
    if (showDelayTimerRef.current || panelsVisible) {
      return;
    }

    showDelayTimerRef.current = window.setTimeout(() => {
      showDelayTimerRef.current = null;
      showPanels();
    }, AUTO_HIDE_REVEAL_DELAY_MS);
  }, [panelsVisible, showPanels]);

  const cancelEdgeIntent = useCallback(() => {
    if (showDelayTimerRef.current) {
      window.clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = null;
    }
  }, []);

  const backupInitializedRef = useRef(false);
  const backupScheduledRef = useRef(false);
  const backupTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    async function checkUser() {
      try {
        const user = await getUser();
        setIsLoggedIn(user !== null);
      } catch {
        setIsLoggedIn(false);
      }
    }

    checkUser();
  }, []);

  useEffect(() => {
    if (isLoggedIn === true && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      const lastRoute = getLastRoute();
      if (lastRoute && lastRoute !== "/signin" && lastRoute !== "/signup") {
        navigate(lastRoute, { replace: true });
      }
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (!window.api?.backupInit || !window.api?.backupSetSession) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("[Backup] Supabase credentials not configured");
      return;
    }

    let isMounted = true;

    const clearBackupSchedule = () => {
      backupTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      backupTimeoutsRef.current = [];
      backupScheduledRef.current = false;
    };

    const scheduleBackups = () => {
      if (backupScheduledRef.current) {
        return;
      }

      backupScheduledRef.current = true;
      backupTimeoutsRef.current = [
        window.setTimeout(async () => {
          try {
            const result = await window.api.backupAllDocuments();
            console.log("[Backup] Completed:", result);
          } catch (err) {
            console.error("[Backup] Error:", err);
          }
        }, 3000),
        window.setTimeout(async () => {
          try {
            const result = await window.api.backupAllHabits?.();
            console.log("[Backup] Habits completed:", result);
          } catch (err) {
            console.error("[Backup] Habits error:", err);
          }
        }, 4000),
        window.setTimeout(async () => {
          try {
            const result = await window.api.backupAllCategories?.();
            console.log("[Backup] Categories completed:", result);
          } catch (err) {
            console.error("[Backup] Categories error:", err);
          }
        }, 5000),
      ];
    };

    const ensureBackupSession = async (session: Session | null) => {
      if (!backupInitializedRef.current) {
        const initResult = await window.api.backupInit(supabaseUrl, supabaseAnonKey);
        if (!initResult.success) {
          throw new Error(initResult.error || "Failed to initialize backup client");
        }
        backupInitializedRef.current = true;
      }

      if (!session?.access_token || !session.refresh_token) {
        clearBackupSchedule();
        await window.api.backupClearSession?.();
        return false;
      }

      const setSessionResult = await window.api.backupSetSession(
        session.access_token,
        session.refresh_token,
      );

      if (!setSessionResult.success) {
        clearBackupSchedule();
        throw new Error(setSessionResult.error || "Failed to authenticate backup client");
      }

      return true;
    };

    const bootstrapBackup = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        const isReady = await ensureBackupSession(session);
        if (isReady) {
          scheduleBackups();
        }
      } catch (err) {
        console.error("[Backup] Init error:", err);
      }
    };

    bootstrapBackup();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const isReady = await ensureBackupSession(session);
        if (isReady) {
          scheduleBackups();
        }
      } catch (error) {
        console.error("[Backup] Session sync error:", error);
      }
    });

    return () => {
      isMounted = false;
      clearBackupSchedule();
      subscription.unsubscribe();
    };
  }, []);

  const isElectron =
    typeof window !== "undefined" && window.api?.windowMinimize;

   useEffect(() => {
     if (!isElectron) {
       return;
     }

     if (settings.autoHideEnabled) {
       showPanels();
       hidePanels(1200);
       return;
     }

     showPanels();
   }, [settings.autoHideEnabled, hidePanels, isElectron, showPanels]);

   useEffect(() => {
     if (!settings.autoHideEnabled || !isElectron) {
       return;
     }

    const handlePointerMove = (event: PointerEvent) => {
      const revealEdge = AUTO_HIDE_TRIGGER_SIZE;
      const sidebarWidth = sidebarCollapsed
        ? SIDEBAR_COLLAPSED_WIDTH
        : SIDEBAR_EXPANDED_WIDTH;

      const nearTopEdge = event.clientY <= revealEdge;
      const nearLeftEdge = event.clientX <= revealEdge;

      if (!panelsVisible) {
        if (nearTopEdge || nearLeftEdge) {
          showPanelsAfterEdgeIntent();
        } else {
          cancelEdgeIntent();
        }
        return;
      }

      const insideTitleBar = event.clientY <= APP_FRAME_SIZE + TITLE_BAR_HEIGHT;
      const insideSidebar =
        event.clientX <= APP_FRAME_SIZE + sidebarWidth &&
        event.clientY >= APP_FRAME_SIZE;

      if (insideTitleBar || insideSidebar || nearTopEdge || nearLeftEdge) {
        showPanels();
        return;
      }

      cancelEdgeIntent();
      hidePanels(AUTO_HIDE_DISMISS_DELAY_MS, false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
   }, [
     settings.autoHideEnabled,
     cancelEdgeIntent,
     hidePanels,
     isElectron,
     panelsVisible,
     showPanels,
     showPanelsAfterEdgeIntent,
     sidebarCollapsed,
   ]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      if (showDelayTimerRef.current) {
        window.clearTimeout(showDelayTimerRef.current);
      }
    };
  }, [clearHideTimer]);

  useEffect(() => {
    if (!isElectron || !window.api?.onFileOpened) return;

    const unsubscribe = window.api.onFileOpened((data) => {
      if (data && data.fileHash) {
        navigate("/reading", {
          state: {
            fileHash: data.fileHash,
            fileBuffer: data.fileBuffer,
            fileName: data.title,
            filePath: data.filePath,
            fileType: data.fileType,
            source: "local",
            navigationId: crypto.randomUUID(),
          },
        });
      }
    });

    return unsubscribe;
  }, [isElectron, navigate]);

   const handleAutoHideToggle = (enabled: boolean) => {
     setAutoHideEnabled(enabled);
     setPanelsVisible(true);
   };

   const handleAutoHideOverlayToggle = (enabled: boolean) => {
     setAutoHideOverlay(enabled);
   };

  const toasterStyle = effectiveTheme === "light"
    ? {
        background: "#f4f4f5",
        color: "#18181b",
        border: "1px solid #d4d4d8",
        borderRadius: "4px",
        padding: "12px 16px",
        fontSize: "14px",
      }
    : {
        background: "#27272a",
        color: "#e4e4e7",
        border: "1px solid #27272a",
        borderRadius: "4px",
        padding: "12px 16px",
        fontSize: "14px",
      };

  return (
    <div
      className="lyceum-app relative h-screen w-screen overflow-hidden bg-zinc-800"
      style={{ padding: APP_FRAME_SIZE }}
    >
       {settings.autoHideEnabled && isElectron && (
         <div
           className="absolute left-0 right-0 top-0 z-[100]"
           style={{ height: AUTO_HIDE_TRIGGER_SIZE }}
           onMouseEnter={showPanelsAfterEdgeIntent}
           onMouseLeave={cancelEdgeIntent}
         />
       )}
       {settings.autoHideEnabled && isElectron && (
         <div
           className="absolute bottom-0 left-0 top-0 z-[100]"
           style={{ width: AUTO_HIDE_TRIGGER_SIZE }}
           onMouseEnter={showPanelsAfterEdgeIntent}
           onMouseLeave={cancelEdgeIntent}
         />
       )}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-zinc-950 text-zinc-100">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              ...toasterStyle,
            },
            success: {
              iconTheme: {
                primary: "var(--accent-500)",
                secondary: effectiveTheme === "light" ? "#f4f4f5" : "#27272a",
              },
              style: {
                borderColor: effectiveTheme === "light" ? "#d4d4d8" : "#27272a",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: effectiveTheme === "light" ? "#f4f4f5" : "#27272a",
              },
              style: {
                borderColor: effectiveTheme === "light" ? "#d4d4d8" : "#27272a",
              },
            },
          }}
        />
         {isElectron && (
           <TitleBar
             collapsed={sidebarCollapsed}
             onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
             autoHideEnabled={settings.autoHideEnabled}
             autoHideOverlay={settings.autoHideOverlay}
             onAutoHideToggle={handleAutoHideToggle}
             onAutoHideOverlayToggle={handleAutoHideOverlayToggle}
             panelsVisible={panelsVisible}
             onShowPanels={showPanels}
             onHidePanels={() => hidePanels()}
           />
         )}
         <ConversionQueueProvider>
         <div className="relative flex flex-1 overflow-hidden">
           <Sidebar
             collapsed={sidebarCollapsed}
             autoHideEnabled={settings.autoHideEnabled}
             autoHideOverlay={settings.autoHideOverlay}
             panelsVisible={panelsVisible}
             onShowPanels={showPanels}
             onHidePanels={() => hidePanels()}
             settingsOpen={settingsOpen}
             onOpenSettings={() => setSettingsOpen(true)}
           />
           <main
             className="flex-1 overflow-y-auto"
             onMouseEnter={() => settings.autoHideEnabled && hidePanels(250)}
           >
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<Dashboard />}
                  />
                }
              />

              <Route
                path="/add_reading"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<AddReadingPage />}
                  />
                }
              />

              <Route
                path="/reading"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<ReadingPage />}
                  />
                }
              />

              <Route
                path="/library"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<Library />}
                  />
                }
              />

              <Route
                path="/conversion"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<ConversionPage />}
                  />
                }
              />

              <Route
                path="/habit_tracker"
                element={
                  <ProtectedRoute
                    isLoggedIn={isLoggedIn}
                    children={<HabitTrackerPage />}
                  />
                }
              />

              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
            </Routes>
          </main>
          <SettingsDialog
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
        </ConversionQueueProvider>
      </div>
    </div>
  );
}

export default App;
