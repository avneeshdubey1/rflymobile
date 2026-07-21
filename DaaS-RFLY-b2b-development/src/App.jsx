import { BrowserRouter, Routes, Route,Navigate } from "react-router-dom";
import B2BRegister from "./pages/B2BRegister";
import B2BLogin from "./pages/B2BLogin";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<B2BLogin />} />
        <Route path="/register" element={<B2BRegister />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;