import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { CardSkeleton, ErrorState } from './components/ui/StateViews';
import { useDaasApp } from './hooks/useDaasApp';
import type { UserRole } from './types/domain';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { PilotDashboard } from './pages/pilot/PilotDashboard';
import { OpsDashboard } from './pages/ops/OpsDashboard';
import { FinanceDashboard } from './pages/finance/FinanceDashboard';
import { BCDashboard } from './pages/customer/BCDashboard';
import { BBDashboard } from './pages/customer/BBDashboard';
import { RepresentativeDashboard } from './pages/representative/RepresentativeDashboard';
import { RepresentativeApprovalsPage } from './pages/representative/RepresentativeApprovalsPage';
import { CustomerCreateRequestPage } from './pages/customer/CustomerCreateRequestPage';
import { RequestsPage } from './pages/admin/RequestsPage';
import { RequestDetailPage } from './pages/admin/RequestDetailPage';
import { CreateRequestPage } from './pages/admin/CreateRequestPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { NotificationsPage } from './pages/admin/NotificationsPage';
import { PilotJobsPage } from './pages/pilot/PilotJobsPage';
import { JobDetailPage } from './pages/pilot/JobDetailPage';
import { OpsTrackerPage } from './pages/ops/OpsTrackerPage';
import { FinancePage } from './pages/finance/FinancePage';
import { LoginPage } from './pages/auth/LoginPage';

const roleHome: Record<UserRole, string> = {
  Admin: '/dashboard', Pilot: '/dashboard', Ops: '/dashboard', Finance: '/dashboard', BC: '/dashboard', BB: '/dashboard', Representative: '/dashboard',
};

function RoleRedirect({ role }: { role: UserRole }) {
  const nav = useNavigate();
  useEffect(() => { nav(roleHome[role], { replace: true }); }, [nav, role]);
  return null;
}

export default function App() {
  return <BrowserRouter><Root /></BrowserRouter>;
}

function Root() {
  const app = useDaasApp();
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('daas_token'));
  const [authUserId, setAuthUserId] = useState<string | null>(localStorage.getItem('daas_user_id'));

  const handleLogin = async (phone: string, otp: string) => {
    try {
      const response = await app.verifyOtp(phone, otp);
      localStorage.setItem('daas_token', response.token);
      localStorage.setItem('daas_user_id', response.user.id);
      setAuthToken(response.token);
      setAuthUserId(response.user.id);
      await app.refresh();
    } catch (err: any) {
      throw new Error(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('daas_token');
    localStorage.removeItem('daas_user_id');
    setAuthToken(null);
    setAuthUserId(null);
    window.location.href = '/'; // Hard reload to clear all state
  };

  if (!authToken || !authUserId) {
    return <LoginPage 
      onSendOtp={async (phone) => app.sendOtp(phone)} 
      onLogin={handleLogin}
      onSignUp={async (payload) => app.signUp(payload)}
    />;
  }

  if (app.loading) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 max-w-3xl mx-auto">
      <CardSkeleton /><CardSkeleton /><CardSkeleton />
    </main>
  );

  if (!app.appData || !app.analytics || app.error) return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <ErrorState title="Could not load PaaS Demo" description={app.error ?? 'Unknown error'} onRetry={() => void app.refresh()} />
    </main>
  );

  const user = app.appData.users.find(u => u.id === authUserId);
  if (!user) {
    handleLogout(); // Invalid session
    return null;
  }

  const unread = app.appData.notifications.filter(n => n.userId === user.id && !n.read).length;

  return (
    <AppLayout currentUser={user} unreadCount={unread}>
      <Routes>
        <Route path="/" element={<RoleRedirect role={user.role} />} />
        <Route path="/dashboard" element={
          user.role === 'Admin' ? <AdminDashboard user={user} app={app} /> :
          user.role === 'Pilot' ? <PilotDashboard user={user} app={app} /> :
          user.role === 'Ops' ? <OpsDashboard user={user} app={app} /> :
          user.role === 'Finance' ? <FinanceDashboard user={user} app={app} /> :
          user.role === 'Representative' ? <RepresentativeDashboard user={user} app={app} /> :
          user.role === 'BC' ? <BCDashboard user={user} app={app} /> :
          <BBDashboard user={user} app={app} />
        } />
        <Route path="/requests" element={<RequestsPage user={user} app={app} />} />
        <Route path="/requests/new" element={
          (user.role === 'BC' || user.role === 'BB') ? <CustomerCreateRequestPage user={user} app={app} /> : <CreateRequestPage user={user} app={app} />
        } />
        <Route path="/requests/:id" element={<RequestDetailPage user={user} app={app} />} />
        <Route path="/pilot/jobs" element={<PilotJobsPage user={user} app={app} />} />
        <Route path="/jobs/:id" element={<JobDetailPage user={user} app={app} />} />
        <Route path="/ops/tracker" element={<OpsTrackerPage user={user} app={app} />} />
        <Route path="/finance/invoices" element={<FinancePage user={user} app={app} />} />
        <Route path="/analytics" element={<AnalyticsPage user={user} app={app} />} />
        <Route path="/users" element={<UsersPage user={user} app={app} />} />
        <Route path="/approvals" element={<RepresentativeApprovalsPage user={user} app={app} />} />
        <Route path="/settings" element={<SettingsPage user={user} app={app} onLogout={handleLogout} />} />
        <Route path="/notifications" element={<NotificationsPage user={user} app={app} />} />
      </Routes>
    </AppLayout>
  );
}
