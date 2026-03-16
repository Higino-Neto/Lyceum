import { Route, Routes } from "react-router-dom";
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
import { useEffect, useState } from "react";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const user = await getUser();
      setIsLoggedIn(user !== null);
    }

    checkUser();
  }, []);

  const isElectron = typeof window !== "undefined" && window.api?.windowMinimize;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-900">
      {isElectron && <TitleBar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />}
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
