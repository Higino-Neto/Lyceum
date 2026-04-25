import { Route, Routes, useNavigate } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage/DashboardPage";
import AddReadingPage from "./pages/AddReadingPage";
import Sidebar from "./components/Sidebar";
import SignIn from "./pages/SignInPage";
import SignUp from "./pages/SignUpPage";
import ReadingPage from "./pages/ReadingPage/ReadingPage";
import Library from "./pages/Library/Library";
import ProfilePage from "./pages/ProfilePage";
import HabitTrackerPage from "./pages/HabitTrackerPage/HabitTrackerPage";
import getUser from "./utils/getUser";
import ProtectedRoute from "./components/ProtectedRoute";
import TitleBar from "./components/TitleBar";
import { Toaster } from "react-hot-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { getLastRoute } from "./hooks/useRouteState";
import { supabase } from "./lib/supabase";

const AUTO_HIDE_STORAGE_KEY = "lyceum_auto_hide";
const AUTO_HIDE_OVERLAY_KEY = "lyceum_auto_hide_overlay";

function loadAutoHideSetting(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_HIDE_STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

function saveAutoHideSetting(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_HIDE_STORAGE_KEY, String(enabled));
  } catch (e) {
    console.warn("Failed to save auto-hide setting:", e);
  }
}

function loadAutoHideOverlaySetting(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_HIDE_OVERLAY_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

function saveAutoHideOverlaySetting(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_HIDE_OVERLAY_KEY, String(enabled));
  } catch (e) {
    console.warn("Failed to save auto-hide overlay setting:", e);
  }
}

function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [autoHideEnabled, setAutoHideEnabled] = useState(loadAutoHideSetting);
  const [autoHideOverlay, setAutoHideOverlay] = useState(loadAutoHideOverlaySetting);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);
  const hasNavigatedRef = useRef(false);

  const showPanels = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setPanelsVisible(true);
  }, []);

  const hidePanels = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    if (autoHideEnabled) {
      hideTimerRef.current = window.setTimeout(() => {
        setPanelsVisible(false);
      }, 400);
    }
  }, [autoHideEnabled]);
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
    saveAutoHideSetting(enabled);
  };

  const handleAutoHideOverlayToggle = (enabled: boolean) => {
    setAutoHideOverlay(enabled);
    saveAutoHideOverlaySetting(enabled);
  };

  return (
    <div className={`relative flex flex-col h-screen overflow-hidden border-[7px] border-zinc-800 rounded bg-zinc-900${
      autoHideEnabled && !panelsVisible && isElectron ? "" : ""
    }`}
>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#27272a",
            color: "#e4e4e7",
            border: "1px solid",
            borderRadius: "4px",
            padding: "12px 16px",
            fontSize: "14px",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#27272a",
            },
            style: {
              borderColor: "#27272a",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#27272a",
            },
            style: {
              borderColor: "#27272a",
            },
          },
        }}
      />
      {isElectron && (
        <TitleBar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          autoHideEnabled={autoHideEnabled}
          autoHideOverlay={autoHideOverlay}
          onAutoHideToggle={handleAutoHideToggle}
          onAutoHideOverlayToggle={handleAutoHideOverlayToggle}
          panelsVisible={panelsVisible}
          onShowPanels={showPanels}
          onHidePanels={hidePanels}
        />
      )}
      {autoHideEnabled && isElectron && (
        <div
          className="absolute top-0 left-0 right-0 h-2 z-[100]"
          onMouseEnter={showPanels}
        />
      )}
      <div className="flex flex-1 overflow-hidden relative">
        {autoHideEnabled && isElectron && (
          <div
            className="absolute top-0 left-0 w-2 h-full z-[100]"
            onMouseEnter={showPanels}
          />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          autoHideEnabled={autoHideEnabled}
          autoHideOverlay={autoHideOverlay}
          panelsVisible={panelsVisible}
          onShowPanels={showPanels}
          onHidePanels={hidePanels}
        />
        <main
          className="flex-1 overflow-y-auto rounded-sm"
          onMouseEnter={() => autoHideEnabled && hidePanels()}
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
              path="/profile"
              element={
                <ProtectedRoute
                  isLoggedIn={isLoggedIn}
                  children={<ProfilePage />}
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
      </div>
    </div>
  );
}

export default App;
