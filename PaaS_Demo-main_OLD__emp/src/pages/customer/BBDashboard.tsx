import { Link } from 'react-router-dom';
import { Task01Icon, CheckmarkCircle01Icon, PlusSignIcon, ArrowRight01Icon, Invoice01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { formatCurrencyINR, formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-50 text-blue-600', Paid: 'bg-green-50 text-green-600', Overdue: 'bg-red-50 text-red-600',
};

export function BBDashboard({ user, app }: Props) {
  if (!app.appData) return null;

  const myRequests = app.appData.requests;
  const activeRequests = myRequests.filter(r => ['Pending', 'Assigned', 'Accepted', 'RepresentativeApprovalPending', 'InProgress'].includes(r.status));
  const completedRequests = myRequests.filter(r => ['Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(r.status));
  
  const myInvoices = app.appData.invoices.filter(i => i.customerId === user.customerId);
  const totalBilled = myInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const stats = [
    { label: 'Active Services', value: activeRequests.length.toString(), icon: Task01Icon, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Completed Services', value: completedRequests.length.toString(), icon: CheckmarkCircle01Icon, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Total Billed', value: formatCurrencyINR(totalBilled), icon: Invoice01Icon, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <SectionHeader title={`Welcome, ${user.name} (B-B)`} description="Manage your organization's drone spraying operations and invoices." />

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
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Recent Requests</h3>
              <Link to="/requests" className="text-xs text-blue-500 font-medium hover:text-blue-600 flex items-center gap-1">
                View all <Icon icon={ArrowRight01Icon} size={14} />
              </Link>
            </div>
            {myRequests.length === 0 ? (
              <EmptyState title="No requests yet" description="You haven't made any service requests yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {myRequests.slice(0, 4).map(r => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface-overlay hover:border-gray-300 transition-colors gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">SR-{r.id.slice(0, 8)}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm font-bold text-text-primary mt-1">{r.cropType} · {r.fieldAreaAcres} acres</p>
                      <p className="text-xs text-text-muted mt-0.5">🗓️ {formatDateIST(r.requestedDate)} ({r.requestedTimeSlot})</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Actions</h3>
            <Link to="/requests/new" className="flex items-center gap-3 px-4 py-4 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm transition-colors group">
              <div className="w-8 h-8 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors shrink-0">
                <Icon icon={PlusSignIcon} size={16} />
              </div>
              <div>
                <p className="font-semibold text-green-800">Raise New Request</p>
                <p className="text-[11px] text-green-600 font-normal mt-0.5">Request drone service</p>
              </div>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Recent Invoices</h3>
            </div>
            {myInvoices.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No invoices yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {myInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="flex flex-col border border-border-subtle rounded-xl p-3 bg-surface-overlay">
                     <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[inv.status] ?? ''}`}>{inv.status}</span>
                        <span className="text-xs text-text-muted">{formatDateIST(inv.invoiceDate)}</span>
                     </div>
                     <div className="flex justify-between items-end mt-2">
                        <span className="text-xs text-text-secondary">{inv.jobIds.length} jobs</span>
                        <span className="text-sm font-bold text-text-primary">{formatCurrencyINR(inv.totalAmount)}</span>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
