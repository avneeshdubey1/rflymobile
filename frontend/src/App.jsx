import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import MarketingDashboard from "./pages/MarketingDashboard";
import PilotDashboard from "./pages/PilotDashboard";
import FleetManagerDashboard from "./pages/FleetManagerDashboard";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Protected Sales/Marketing Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'sales']} />}>
            <Route path="/marketing" element={<MarketingDashboard />} />
          </Route>

          {/* Protected Pilot Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'pilot']} />}>
            <Route path="/pilot" element={<PilotDashboard />} />
          </Route>

          {/* Protected Fleet Manager Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'fleet-manager']} />}>
            <Route path="/fleet-manager" element={<FleetManagerDashboard />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
