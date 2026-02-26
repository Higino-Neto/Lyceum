import { Route, Routes } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage/DashboardPage";
import AddReadingPage from "./pages/AddReadingPage";
import Sidebar from "./components/Sidebar";
import SignIn from "./pages/SignInPage";
import SignUp from "./pages/SignUpPage";
import ReadingPage from "./pages/ReadingPage/ReadingPage";

function App() {
  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
      <main className="w-full overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add_reading" element={<AddReadingPage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
      </div>
    </>
  );
}

export default App;
