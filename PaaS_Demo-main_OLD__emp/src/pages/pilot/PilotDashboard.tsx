import { Link } from 'react-router-dom';
import { Task01Icon, DroneIcon, CheckmarkCircle01Icon, CreditCardIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SectionHeader } from '../../components/shared';
import { formatCurrencyINR, formatDateTimeIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function PilotDashboard({ user, app }: Props) {
  if (!app.analytics || !app.appData) return null;

  const pilotRequests = app.appData.requests.filter(r => r.assignment?.pilotId === user.id);

  const activeJobsCount = pilotRequests.filter(r => ['Assigned', 'Accepted', 'RepresentativeApprovalPending', 'InProgress'].includes(r.status)).length;
  const completedJobsCount = pilotRequests.filter(r => ['Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(r.status)).length;
  const totalEarnings = pilotRequests
    .filter(r => ['Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(r.status))
    .reduce((sum, r) => sum + (Number(r.amountPerAcre) * Number(r.fieldAreaAcres)), 0);
  const completionRate = pilotRequests.length > 0 
    ? Math.round((completedJobsCount / pilotRequests.length) * 100)
    : 0;

  const stats = [
    { label: 'My Total Jobs', value: pilotRequests.length.toString(), icon: DroneIcon, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Active Tasks', value: activeJobsCount.toString(), icon: Task01Icon, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckmarkCircle01Icon, color: 'from-green-500 to-green-600', bg: 'bg-green-50', iconColor: 'text-green-500' },
    { label: 'My Earnings', value: formatCurrencyINR(totalEarnings), icon: CreditCardIcon, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', iconColor: 'text-purple-500' },
  ];

  const recentEvents = pilotRequests
    .flatMap(r => r.statusEvents.map(e => ({ ...e, requestId: r.id })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const statusCounts = pilotRequests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const activePilotJobs = pilotRequests.filter(r => ['Assigned', 'Accepted', 'RepresentativeApprovalPending', 'InProgress'].includes(r.status));

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <SectionHeader 
        title={`Welcome, ${user.name}`} 
        description="Your personalized drone spraying operations dashboard."
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
        {/* Left Area - Active Jobs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">My Active Tasks</h3>
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{activePilotJobs.length} In Progress</span>
          </div>
          {activePilotJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-text-muted mb-3">
                <Icon icon={DroneIcon} size={24} />
              </div>
              <p className="text-sm font-medium text-text-primary">No active tasks</p>
              <p className="text-xs text-text-muted mt-1">Enjoy your time or check later for new assignments.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activePilotJobs.map(r => {
                let actionText = '';
                let actionColor = '';
                if (r.status === 'Assigned') {
                  actionText = 'Accept Job';
                  actionColor = 'bg-green-500 hover:bg-green-600 text-white';
                } else if (r.status === 'Accepted') {
                  actionText = 'Start Spraying';
                  actionColor = 'bg-blue-500 hover:bg-blue-600 text-white';
                } else if (r.status === 'RepresentativeApprovalPending') {
                  actionText = 'Awaiting Rep Approval';
                  actionColor = 'bg-amber-100 text-amber-800 cursor-not-allowed';
                } else if (r.status === 'InProgress') {
                  actionText = 'Complete Spraying';
                  actionColor = 'bg-green-500 hover:bg-green-600 text-white';
                }

                return (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface-overlay hover:border-gray-300 transition-colors gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">SR-{r.id.slice(0, 8)}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm font-bold text-text-primary mt-1">{r.cropType} · {r.fieldAreaAcres} acres</p>
                      <p className="text-xs text-text-muted mt-0.5">🗓️ Slot: {r.requestedTimeSlot}</p>
                    </div>
                    <Link to={`/jobs/${r.id}`} className={`px-4 py-2 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center ${actionColor}`}>
                      {actionText}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Request Distribution */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Job Status Breakdown</h3>
          <div className="flex flex-col gap-2.5">
            {Object.entries(statusCounts).map(([status, count]) => {
              const totalReqs = pilotRequests.length || 1;
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
          <Link to="/pilot/jobs" className="text-xs text-blue-500 font-medium hover:text-blue-600 flex items-center gap-1">
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
