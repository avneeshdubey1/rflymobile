import { Link } from 'react-router-dom';
import { Task01Icon, CheckmarkCircle01Icon, ArrowRight01Icon, Analytics01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatDateIST, formatDateTimeIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function OpsDashboard({ user, app }: Props) {
  if (!app.appData || !app.analytics) return null;

  const pending = app.appData.requests.filter(r => ['Completed', 'PaymentReceived'].includes(r.status));
  const tracked = app.appData.requests.filter(r => ['TrackerUpdated', 'Invoiced'].includes(r.status));
  const customers = Object.fromEntries(app.appData.customers.map(c => [c.id, c]));

  const recentEvents = app.appData.requests
    .flatMap(r => r.statusEvents.map(e => ({ ...e, requestId: r.id })))
    .filter(e => e.actorUserId.includes('Ops'))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Total Requests', value: app.appData.requests.length, icon: Analytics01Icon, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Pending Updates', value: pending.length, icon: Task01Icon, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Tracked / Ready for Invoice', value: tracked.length, icon: CheckmarkCircle01Icon, color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <SectionHeader title={`Welcome, ${user.name}`} description="Operational tracker dashboard for updating requests before invoicing." />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border-subtle p-5 flex flex-col hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <Icon icon={s.icon} size={20} className={s.color} />
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-muted font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pending Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Pending Tracker Updates</h3>
            <Link to="/ops/tracker" className="text-xs text-blue-500 font-medium hover:text-blue-600 flex items-center gap-1">
              View all <Icon icon={ArrowRight01Icon} size={14} />
            </Link>
          </div>
          {pending.length === 0 ? (
            <EmptyState title="All caught up" description="No completed requests pending tracker update." />
          ) : (
            <div className="flex flex-col gap-3">
              {pending.slice(0, 3).map(r => (
                <article key={r.id} className="bg-surface-overlay/30 rounded-xl border border-border-subtle p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-text-primary uppercase tracking-wider">SR-{r.id.slice(0,8)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-text-secondary">{customers[r.customerId]?.name} · {r.customerType === 'BB' ? 'B-B' : 'B-C'} · {r.cropType}</p>
                  <p className="text-xs text-text-muted mt-1">{r.fieldAreaAcres} acres · {formatDateIST(r.requestedDate)}</p>
                  <button
                    className="mt-3 w-full h-10 rounded-xl bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors cursor-pointer border-0 flex items-center justify-center gap-2"
                    type="button"
                    onClick={() => void app.updateTracker(r.id, 'Ops verified and tracker synced', user).then(() => toast('Tracker updated'))}
                  >
                    <Icon icon={CheckmarkCircle01Icon} size={16} /> Mark Tracker Updated
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">My Recent Activity</h3>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-text-muted py-5 text-center">No recent ops updates.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {recentEvents.map(evt => (
                <div key={evt.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold uppercase tracking-wider">SR-{evt.requestId.slice(0, 8)}</span>
                  </p>
                  <p className="text-[11px] text-text-muted">{evt.note}</p>
                  <p className="text-[10px] text-text-muted font-medium mt-1">{formatDateTimeIST(evt.at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
