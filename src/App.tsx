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
import { useEffect, useState, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { getLastRoute } from "./hooks/useRouteState";
import { supabase } from "./lib/supabase";

function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const hasNavigatedRef = useRef(false);
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-900">
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
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="w-full overflow-y-auto rounded-sm">
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
