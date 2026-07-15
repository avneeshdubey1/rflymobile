import { Link } from 'react-router-dom';
import { Task01Icon, DroneIcon, CheckmarkCircle01Icon, CreditCardIcon, PlusSignIcon, ArrowRight01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SectionHeader } from '../../components/shared';
import { formatCurrencyINR, formatDateTimeIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function AdminDashboard({ user, app }: Props) {
  if (!app.analytics || !app.appData) return null;

  const stats = [
    { label: 'Total Requests', value: app.analytics.totalRequests.toString(), icon: Task01Icon, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Active Jobs', value: app.analytics.activeRequests.toString(), icon: DroneIcon, color: 'from-green-500 to-green-600', bg: 'bg-green-50', iconColor: 'text-green-500' },
    { label: 'Completion Rate', value: `${app.analytics.completionRate}%`, icon: CheckmarkCircle01Icon, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', iconColor: 'text-purple-500' },
    { label: 'Revenue', value: formatCurrencyINR(app.analytics.totalRevenue), icon: CreditCardIcon, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
  ];

  const recentEvents = app.appData.requests
    .flatMap(r => r.statusEvents.map(e => ({ ...e, requestId: r.id })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const pilots = app.appData.users.filter(u => u.role === 'Pilot');
  const activePilots = pilots.filter(p => app.appData!.requests.some(r => r.assignment?.pilotId === p.id && r.status === 'InProgress'));

  const statusCounts = app.appData.requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <SectionHeader 
        title={`Welcome, ${user.name}`} 
        description={"Operational summary across all drone service workflows."} 
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        {stats.map(s => (
          <article key={s.label} className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon icon={s.icon} size={20} className={s.iconColor} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{s.value}</p>
            <p className="text-xs text-text-muted font-medium mt-1">{s.label}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Area - Quick Actions */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2.5">
            <Link to="/requests/new" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm transition-colors">
              <Icon icon={PlusSignIcon} size={18} /> New Service Request
            </Link>
            <Link to="/requests" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-sm transition-colors">
              <Icon icon={Task01Icon} size={18} /> View All Requests
            </Link>
            <Link to="/ops/tracker" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium text-sm transition-colors">
              <Icon icon={Task01Icon} size={18} /> Operation Tracker
            </Link>
            <Link to="/finance/invoices" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-sm transition-colors">
              <Icon icon={CreditCardIcon} size={18} /> Financial Invoices
            </Link>
            <Link to="/users" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium text-sm transition-colors">
              <Icon icon={UserGroupIcon} size={18} /> Manage Users
            </Link>
          </div>
        </div>

        {/* Pilot Availability */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Pilot Status</h3>
            <div className="flex flex-col gap-3">
              {pilots.map(p => {
                const isActive = activePilots.some(a => a.id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                      <p className="text-[11px] text-text-muted">{isActive ? 'Spraying in progress' : 'Available'}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  </div>
                );
              })}
            </div>
          </div>

        {/* Request Distribution */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Request Distribution</h3>
          <div className="flex flex-col gap-2.5">
            {Object.entries(statusCounts).map(([status, count]) => {
              const totalReqs = app.appData!.requests.length || 1;
              const pct = Math.round((count / totalReqs) * 100);
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary font-medium">{status}</span>
                    <span className="text-text-muted">{count}</span>
                  </div>
                  <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
          <Link to="/requests" className="text-xs text-blue-500 font-medium hover:text-blue-600 flex items-center gap-1">
            View all <Icon icon={ArrowRight01Icon} size={14} />
          </Link>
        </div>
        <div className="flex flex-col divide-y divide-border-subtle">
          {recentEvents.map(evt => (
            <div key={evt.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full bg-surface-overlay flex items-center justify-center shrink-0">
                <Icon icon={Task01Icon} size={14} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">SR-{evt.requestId.slice(0, 8)}</span>
                  <span className="text-text-muted mx-1.5">→</span>
                  <StatusBadge status={evt.toStatus} />
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">{formatDateTimeIST(evt.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
