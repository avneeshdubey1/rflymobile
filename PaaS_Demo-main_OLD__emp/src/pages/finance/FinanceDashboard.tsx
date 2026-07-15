import { Link } from 'react-router-dom';
import { Invoice01Icon, Analytics01Icon, UserGroupIcon, ArrowRight01Icon, AddInvoiceIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatCurrencyINR, formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-50 text-blue-600', Paid: 'bg-green-50 text-green-600', Overdue: 'bg-red-50 text-red-600',
};

export function FinanceDashboard({ user, app }: Props) {
  if (!app.appData || !app.analytics) return null;
  const appData = app.appData;

  const bbCustomers = appData.customers.filter(c => c.type === 'BB');
  const totalRev = appData.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

  const stats = [
    { label: 'Total Invoiced Revenue', value: formatCurrencyINR(totalRev), icon: Analytics01Icon, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Invoices', value: appData.invoices.length.toString(), icon: Invoice01Icon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'B-B Customers', value: bbCustomers.length.toString(), icon: UserGroupIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const pendingInvoicingCustomers = bbCustomers.map(c => {
    const eligibleCount = appData.requests.filter(r => r.customerId === c.id && r.status === 'TrackerUpdated').length;
    return { ...c, eligibleCount };
  }).filter(c => c.eligibleCount > 0);

  const gen = async (customerId: string) => {
    try { await app.generateInvoice(customerId, user); toast('Invoice generated successfully', 'success'); } 
    catch (e) { toast(e instanceof Error ? e.message : 'Failed to generate invoice', 'error'); }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <SectionHeader title={`Welcome, ${user.name}`} description="Financial overview and invoicing dashboard." />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border-subtle p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
              <Icon icon={s.icon} size={24} className={s.color} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Invoice Generation */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Pending B-B Invoices</h3>
            <Link to="/finance/invoices" className="text-xs text-blue-500 font-medium hover:text-blue-600 flex items-center gap-1">
              View all <Icon icon={ArrowRight01Icon} size={14} />
            </Link>
          </div>
          {pendingInvoicingCustomers.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-border-subtle">
              🎉 All B-B invoices are up to date! There are no pending tracked requests waiting for invoicing.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingInvoicingCustomers.slice(0, 3).map(c => (
                <article key={c.id} className="bg-surface-overlay/30 rounded-xl border border-border-subtle p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        {c.eligibleCount} pending request{c.eligibleCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1">Billing cycle: {c.billingCycleDays} days</p>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors cursor-pointer border-0 flex items-center gap-1.5" type="button" onClick={() => void gen(c.id)}>
                    <Icon icon={AddInvoiceIcon} size={14} /> Generate
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Recent Invoices</h3>
          {appData.invoices.length === 0 ? (
            <EmptyState title="No invoices" description="No invoices have been generated yet." />
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {appData.invoices.slice(0, 5).map(inv => {
                const customer = appData.customers.find(c => c.id === inv.customerId);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-text-primary uppercase tracking-wider">{customer?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">{formatDateIST(inv.invoiceDate)} · {inv.jobIds.length} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-primary">{formatCurrencyINR(inv.totalAmount)}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[inv.status] ?? ''}`}>{inv.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
