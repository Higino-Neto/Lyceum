import { Route, Routes } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage/DashboardPage";
import AddReadingPage from "./pages/AddReadingPage";
import Sidebar from "./components/Sidebar";
import SignIn from "./pages/SignInPage";
import SignUp from "./pages/SignUpPage";
import ReadingPage from "./pages/ReadingPage/ReadingPage";
import Library from "./pages/Library/Library";
import getUser from "./utils/getUser";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect, useState } from "react";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    async function checkUser() {
      const user = await getUser();
      setIsLoggedIn(user !== null);
    }

    checkUser();
  }, []);
  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="w-full overflow-y-auto">
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

            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;
