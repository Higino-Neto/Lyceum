import { Route, Routes } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/DashboardPage";
import AddReadingPage from "./pages/AddReadingPage";
import ReadingIframe from "./pages/ReadingPage";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <>
      <div className="flex">
        <Sidebar />
      <main className="w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add_reading" element={<AddReadingPage />} />
          <Route path="/reading" element={<ReadingIframe />} />
        </Routes>
      </main>
      </div>
    </>
  );
}

export default App;
