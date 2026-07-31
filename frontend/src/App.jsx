import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import EmployeeForgotPassword from "./pages/EmployeeForgotPassword";
import EmployeeRegistration from "./pages/EmployeeRegistration";
import AdminDashboard from "./pages/AdminDashboard";
import MarketingDashboard from "./pages/MarketingDashboard";
import PilotDashboard from "./pages/PilotDashboard";
import FleetManagerDashboard from "./pages/FleetManagerDashboard";
import NotFound from "./pages/NotFound";
import FarmerDashboard from "./pages/FarmerDashboard";
import FarmerLogin from "./pages/FarmerLogin";
import FarmerRegister from "./pages/FarmerRegister";
import RegistrationSuccess from "./pages/RegistrationSuccess";
import Settings from "./pages/Settings";

import B2BLogin from "./pages/B2BLogin";
import B2BRegister from "./pages/B2BRegister";
import B2BForgotPassword from "./pages/B2BForgotPassword";

import BusinessDashboard from "./pages/BusinessDashboard";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/request" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<EmployeeForgotPassword />} />
          <Route path="/farmer/login" element={<FarmerLogin />} />
          <Route path="/farmer/register" element={<FarmerRegister />} />
          <Route path="/success" element={<RegistrationSuccess />} />
          
          {/* Business Routes */}
          <Route path="/business/login" element={<B2BLogin />} />
          <Route path="/business/register" element={<B2BRegister />} />
          <Route path="/business/forgot-password" element={<B2BForgotPassword />} />
          
          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/employee/register" element={<EmployeeRegistration />} />
          </Route>

          {/* Protected Sales/Marketing Routes */}
          <Route element={<ProtectedRoute allowedRoles={['sales']} />}>
            <Route path="/marketing" element={<MarketingDashboard />} />
          </Route>

          {/* Protected Pilot Routes */}
          <Route element={<ProtectedRoute allowedRoles={['pilot']} />}>
            <Route path="/pilot" element={<PilotDashboard />} />
          </Route>

          {/* Protected Fleet Manager Routes */}
          <Route element={<ProtectedRoute allowedRoles={['fleet-manager']} />}>
            <Route path="/fleet-manager" element={<FleetManagerDashboard />} />
          </Route>

          {/* Protected Farmer Routes */}
          <Route element={<ProtectedRoute allowedRoles={['farmer']} />}>
            <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
          </Route>

          {/* Protected Business Routes */}
          <Route element={<ProtectedRoute allowedRoles={['business']} />}>
            <Route path="/business/dashboard" element={<BusinessDashboard />} />
          </Route>

          {/* Shared Protected Settings Route */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'sales', 'fleet-manager', 'pilot', 'farmer', 'business']} />}>
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
