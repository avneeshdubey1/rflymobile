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
import FarmerDashboard from "./pages/FarmerDashboard";
import FarmerLogin from "./pages/FarmerLogin";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/farmer/login" element={<FarmerLogin />} />
          
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

          {/* Protected Farmer Routes */}
          <Route element={<ProtectedRoute allowedRoles={['farmer']} />}>
            <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
