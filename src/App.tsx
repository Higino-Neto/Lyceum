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
import getUser from "./utils/getUser";
import ProtectedRoute from "./components/ProtectedRoute";
import TitleBar from "./components/TitleBar";
import { Toaster } from "react-hot-toast";
import { useEffect, useState, useRef } from "react";
import { getLastRoute } from "./hooks/useRouteState";

function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const hasNavigatedRef = useRef(false);

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

            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
