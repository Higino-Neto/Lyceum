import { Route, Routes } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage";
import ReadingPage from "./pages/ReadingPage";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <>
      <div className="flex">
        <Sidebar />
      <main className="w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reading" element={<ReadingPage />} />
        </Routes>
      </main>
      </div>
    </>
  );
}

export default App;
