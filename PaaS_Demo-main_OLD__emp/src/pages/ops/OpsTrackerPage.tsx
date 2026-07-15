import { CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function OpsTrackerPage({ user, app }: Props) {
  if (!app.appData) return null;
  if (!['Ops', 'Admin'].includes(user.role)) return <ErrorState title="Access denied" description="Tracker is restricted to Ops and Admin." onRetry={() => void app.refresh()} />;

  const pending = app.appData.requests.filter(r => ['Completed', 'PaymentReceived'].includes(r.status));
  const tracked = app.appData.requests.filter(r => ['TrackerUpdated', 'Invoiced'].includes(r.status));
  const customers = Object.fromEntries(app.appData.customers.map(c => [c.id, c]));

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <SectionHeader title="Ops Request Tracker" description="Update tracker entries before invoicing can begin." />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in">
        {[
          { label: 'Pending Updates', value: pending.length, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Tracked', value: tracked.length, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Total Requests', value: app.appData.requests.length, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border-subtle p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-text-muted font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending Section */}
      <h3 className="text-sm font-semibold text-text-primary">Pending Tracker Updates</h3>
      {pending.length === 0 ? (
        <EmptyState title="All caught up" description="No completed requests pending tracker update." />
      ) : (
        <div className="flex flex-col gap-3 animate-slide-up">
          {pending.map(r => (
            <article key={r.id} className="bg-white rounded-2xl border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-text-primary">{r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-text-secondary">{customers[r.customerId]?.name} · {r.customerType === 'BB' ? 'B-B' : 'B-C'} · {r.cropType}</p>
              <p className="text-xs text-text-muted mt-1">{r.fieldAreaAcres} acres · {formatDateIST(r.requestedDate)}</p>
              <button
                className="mt-3 w-full h-11 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors cursor-pointer border-0 flex items-center justify-center gap-2"
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
  );
}
