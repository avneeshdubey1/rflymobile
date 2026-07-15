import { Link } from 'react-router-dom';
import { ArrowRight01Icon, DroneIcon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function PilotJobsPage({ user, app }: Props) {
  if (!app.appData) return null;
  if (user.role !== 'Pilot') return <ErrorState title="Access denied" description="Only pilots can view jobs." onRetry={() => void app.refresh()} />;

  const jobs = app.appData.requests.filter(r => r.assignment?.pilotId === user.id);
  const active = jobs.filter(j => j.status === 'InProgress').length;
  const completed = jobs.filter(j => ['Completed','PaymentReceived','TrackerUpdated','Invoiced'].includes(j.status)).length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <SectionHeader title="My Jobs" description="Your assigned drone spraying operations." />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in">
        {[
          { label: 'Total Assigned', value: jobs.length, icon: DroneIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active', value: active, icon: DroneIcon, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Completed', value: completed, icon: CheckmarkCircle01Icon, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border-subtle p-4 text-center">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon icon={s.icon} size={18} className={s.color} />
            </div>
            <p className="text-xl font-bold text-text-primary">{s.value}</p>
            <p className="text-[11px] text-text-muted font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No assigned jobs" description="New assignments will appear here." />
      ) : (
        <div className="flex flex-col gap-3 animate-slide-up">
          {jobs.map(r => (
            <Link key={r.id} to={`/jobs/${r.id}`} className="bg-white rounded-2xl border border-border-subtle p-4 flex flex-col gap-2 hover:shadow-md transition-all active:scale-[0.99]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-primary">{r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-text-secondary">{r.cropType} · {r.fieldAreaAcres} acres</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{formatDateIST(r.requestedDate)} · {r.requestedTimeSlot}</span>
                <Icon icon={ArrowRight01Icon} size={14} className="text-text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
